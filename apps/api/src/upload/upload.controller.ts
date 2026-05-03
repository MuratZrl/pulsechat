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

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly r2: R2Service) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      // Note: client-supplied mimetype is no longer trusted here — magic-byte
      // validation runs after multer accepts the file (see uploadFile).
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_SET.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('File type not allowed'), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() _req: unknown,
  ) {
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

    const safeOriginalName = sanitizeFilename(file.originalname);
    const sanitizedFile: Express.Multer.File = {
      ...file,
      mimetype: trustedMime,
      originalname: safeOriginalName,
    };

    const url = await this.r2.upload(sanitizedFile);

    const isImage = trustedMime.startsWith('image/');
    const isVoice = trustedMime.startsWith('audio/');

    return {
      url,
      name: safeOriginalName,
      size: this.formatSize(file.size),
      type: isImage ? 'image' : isVoice ? 'voice' : 'file',
      mimetype: trustedMime,
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
