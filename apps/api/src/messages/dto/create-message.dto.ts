import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsObject()
  attachment?: {
    name: string;
    type: 'image' | 'file' | 'voice';
    size: string;
    url?: string;
    duration?: number;
  };

  @IsOptional()
  @IsObject()
  forwarded?: {
    originalSender: string;
    originalRoom: string;
  };
}
