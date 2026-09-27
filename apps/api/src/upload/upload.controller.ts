import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { R2Service } from './r2.service';
import { RedisService } from '../redis/redis.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
] as const;

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

const MAX_TEXT_PROBE_BYTES = 8 * 1024;

function sanitizeFilename(name: string): string {
  // Strip path separators, then keep only alphanum + . - _
  const base = name.replace(/[\\/]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base.slice(0, 255) : 'file';
}

function looksLikePlainText(buf: Buffer): boolean {
  const probe = buf.subarray(0, MAX_TEXT_PROBE_BYTES);
  for (const byte of probe) {
    if (byte === 0) return false;
  }
  return true;
}

// Shared multer config for both upload routes. The client-supplied mimetype
// is only a first filter — magic-byte validation runs after multer accepts
// the file (see toTrustedFile).
const UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED_MIME_SET.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('File type not allowed'), false);
    }
  },
};

// How long an uploaded attachment can be claimed by a message.
const UPLOAD_CLAIM_TTL_SECONDS = 24 * 60 * 60;

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(
    private readonly r2: R2Service,
    private readonly redis: RedisService,
  ) {}

  // Message attachments. Stored in the private bucket and returned as a key;
  // readers get a short-lived signed URL from GET /messages/:id/attachment,
  // which checks room membership.
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { id: string } },
  ) {
    const trusted = await this.toTrustedFile(file);
    const key = await this.r2.uploadAttachment(trusted);

    // Remember who uploaded the key: a message may only attach its sender's
    // own upload, since keys are visible to every reader of a signed URL.
    await this.redis.set(`upload:${key}`, req.user.id, UPLOAD_CLAIM_TTL_SECONDS);

    const isImage = trusted.mimetype.startsWith('image/');
    const isVoice = trusted.mimetype.startsWith('audio/');

    return {
      key,
      name: trusted.originalname,
      size: this.formatSize(file.size),
      type: isImage ? 'image' : isVoice ? 'voice' : 'file',
      mimetype: trusted.mimetype,
    };
  }

  // Avatars stay in the public bucket (they are shown to everyone anyway).
  @Post('avatar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const trusted = await this.toTrustedFile(file);
    if (!trusted.mimetype.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    const url = await this.r2.upload(trusted);
    return { url };
  }

  /** Magic-byte check plus filename sanitising; returns the file to store. */
  private async toTrustedFile(
    file: Express.Multer.File | undefined,
  ): Promise<Express.Multer.File> {
    if (!file) throw new BadRequestException('No file provided');

    const detected = await fileTypeFromBuffer(file.buffer);

    let trustedMime: string;
    if (detected) {
      if (!ALLOWED_MIME_SET.has(detected.mime)) {
        throw new BadRequestException('File content does not match an allowed type');
      }
      trustedMime = detected.mime;
    } else {
      // file-type can't fingerprint plain text — accept only if no null bytes
      // in the first 8 KB AND the client claimed text/plain.
      if (file.mimetype !== 'text/plain' || !looksLikePlainText(file.buffer)) {
        throw new BadRequestException('File content does not match an allowed type');
      }
      trustedMime = 'text/plain';
    }

    return {
      ...file,
      mimetype: trustedMime,
      originalname: sanitizeFilename(file.originalname),
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
