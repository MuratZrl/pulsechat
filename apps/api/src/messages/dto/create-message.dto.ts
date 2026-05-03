import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsIn(['image', 'file', 'voice'])
  type: 'image' | 'file' | 'voice';

  // Pre-formatted display string ("1.2 MB"), not a numeric byte count.
  @IsString()
  @MaxLength(20)
  size: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class ForwardedDto {
  @IsString()
  @MaxLength(50)
  originalSender: string;

  @IsString()
  @MaxLength(50)
  originalRoom: string;
}

export class CreateMessageDto {
  @IsString()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  attachment?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ForwardedDto)
  forwarded?: ForwardedDto;
}
