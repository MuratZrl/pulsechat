import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private s3: S3Client;
  private bucket: string;
  private attachmentsBucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('R2_BUCKET', 'pulsechat-uploads');
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL', '');

    // Message attachments live in a bucket without public access and are only
    // read through short-lived signed URLs. Avatars stay in the public bucket.
    this.attachmentsBucket =
      this.config.get<string>('R2_ATTACHMENTS_BUCKET') || this.bucket;
    if (this.attachmentsBucket === this.bucket) {
      this.logger.warn(
        'R2_ATTACHMENTS_BUCKET is not set: attachments go to the public bucket and stay readable by URL',
      );
    }

    // R2_ENDPOINT overrides the R2 endpoint, e.g. for a local S3-compatible
    // server; those typically need path-style bucket addressing.
    const endpointOverride = this.config.get<string>('R2_ENDPOINT');
    this.s3 = new S3Client({
      region: 'auto',
      endpoint:
        endpointOverride ||
        `https://${this.config.get<string>('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com`,
      forcePathStyle: Boolean(endpointOverride),
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const ext = extname(file.originalname);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  /** Stores a message attachment privately; returns its object key. */
  async uploadAttachment(file: Express.Multer.File): Promise<string> {
    const key = `attachments/${randomUUID()}${extname(file.originalname)}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.attachmentsBucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return key;
  }

  /** Time-limited GET URL for a private attachment. */
  getAttachmentUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.attachmentsBucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** Object key for a URL minted by upload(), or null for any other URL. */
  keyFromPublicUrl(url: string): string | null {
    if (!this.publicUrl) return null;
    const prefix = `${this.publicUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await this.deleteFrom(this.bucket, keys);
  }

  async deleteAttachments(keys: string[]): Promise<void> {
    await this.deleteFrom(this.attachmentsBucket, keys);
  }

  private async deleteFrom(bucket: string, keys: string[]): Promise<void> {
    // One DeleteObject per key: a handful of objects per account, and it
    // avoids the checksum requirements of the multi-object delete call.
    await Promise.all(
      keys.map((Key) =>
        this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })),
      ),
    );
  }
}
