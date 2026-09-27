import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { EditMessageDto } from '../../messages/dto/edit-message.dto';

// Payload classes for every socket event. The gateway's ValidationPipe only
// checks a @MessageBody() whose type is a class — the previous inline and
// intersection types reflected as Object, so nothing was validated and the
// socket path ignored the 4000-char cap the HTTP DTOs enforce. Message text
// limits come from the same CreateMessageDto/EditMessageDto HTTP uses.

// cuid ids are 25 chars; the cap only stops oversized junk.
const ID_MAX_LENGTH = 64;

export class RoomEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX_LENGTH)
  roomId: string;
}

export class SendMessageEventDto extends CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX_LENGTH)
  roomId: string;
}

export class EditMessageEventDto extends EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX_LENGTH)
  messageId: string;
}

export class MessageEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX_LENGTH)
  messageId: string;
}

export class ToggleReactionEventDto extends MessageEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  emoji: string;
}

export class MarkReadEventDto extends MessageEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX_LENGTH)
  roomId: string;
}
