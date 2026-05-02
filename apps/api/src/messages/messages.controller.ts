import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString } from 'class-validator';

class ToggleReactionDto {
  @IsString()
  emoji: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('rooms/:roomId/messages/search')
  searchMessages(
    @Request() req: { user: { id: string } },
    @Param('roomId') roomId: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    // Minimum 2 characters: a single-char query degrades to a full-table
    // LIKE '%x%' scan in Postgres, which is a cheap DoS vector for any
    // authenticated user. Two chars matches typical search UX too.
    const trimmed = q?.trim() ?? '';
    if (trimmed.length < 2) return [];
    return this.messagesService.searchMessages(
      roomId,
      req.user.id,
      trimmed,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('rooms/:roomId/messages')
  getMessages(
    @Request() req: { user: { id: string } },
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messagesService.getMessages(
      roomId,
      req.user.id,
      limit ? parseInt(limit) : 30,
      before,
    );
  }

  @Post('rooms/:roomId/messages')
  sendMessage(
    @Request() req: { user: { id: string; name: string } },
    @Param('roomId') roomId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(
      roomId,
      req.user.id,
      dto,
      req.user.name,
    );
  }

  @Patch('messages/:id')
  editMessage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(id, req.user.id, dto);
  }

  @Delete('messages/:id')
  deleteMessage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.messagesService.deleteMessage(id, req.user.id);
  }

  @Post('messages/:id/reactions')
  toggleReaction(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.messagesService.toggleReaction(id, req.user.id, dto.emoji);
  }

  @Get('mentions')
  getUnreadMentions(@Request() req: { user: { id: string } }) {
    return this.messagesService.getUnreadMentions(req.user.id);
  }

  @Post('rooms/:roomId/mentions/read')
  markMentionsRead(
    @Request() req: { user: { id: string } },
    @Param('roomId') roomId: string,
  ) {
    return this.messagesService.markMentionsRead(req.user.id, roomId);
  }

  @Get('rooms/:roomId/receipts')
  getReceipts(
    @Query('ids') ids: string,
  ) {
    const messageIds = ids ? ids.split(',').filter(Boolean) : [];
    return this.messagesService.getReceipts(messageIds);
  }
}
