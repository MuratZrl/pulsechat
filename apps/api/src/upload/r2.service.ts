import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';

@Injectable()
export class R2Service {
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('R2_BUCKET', 'pulsechat-uploads');
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL', '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com`,
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
}
