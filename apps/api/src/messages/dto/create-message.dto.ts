import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
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

  // Forwarding names the source message; the server copies its content and
  // fills the "forwarded from" label itself. Client-supplied forwarded
  // metadata used to be stored verbatim, so any user could post a message
  // labelled as forwarded from anyone.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  forwardFromMessageId?: string;
}
