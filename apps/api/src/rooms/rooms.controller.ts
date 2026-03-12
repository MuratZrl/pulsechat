import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  getRooms(@Request() req: { user: { id: string } }) {
    return this.roomsService.getRooms(req.user.id);
  }

  @Post()
  createRoom(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(req.user.id, dto);
  }

  @Get(':id')
  getRoom(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.getRoom(id, req.user.id);
  }

  @Post(':id/join')
  joinRoom(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.joinRoom(id, req.user.id);
  }

  @Delete(':id/leave')
  leaveRoom(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.leaveRoom(id, req.user.id);
  }

  @Post(':id/read')
  markRead(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.markRead(id, req.user.id);
  }

  // ─── Direct Messages ─────────────────────────────────────────────────────

  @Post('dm/:userId')
  getOrCreateDm(
    @Request() req: { user: { id: string } },
    @Param('userId') userId: string,
  ) {
    return this.roomsService.getOrCreateDm(req.user.id, userId);
  }

  @Get('users/list')
  getUsers(@Request() req: { user: { id: string } }) {
    return this.roomsService.getUsers(req.user.id);
  }

  // ─── Invite Links ─────────────────────────────────────────────────────────

  @Get(':id/invite')
  getInvite(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.getInvite(id, req.user.id);
  }

  @Post(':id/invite')
  generateInvite(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.generateInvite(id, req.user.id);
  }

  @Delete(':id/invite')
  revokeInvite(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.revokeInvite(id, req.user.id);
  }

  @Post('invite/:code/join')
  joinByInvite(
    @Request() req: { user: { id: string } },
    @Param('code') code: string,
  ) {
    return this.roomsService.joinByInvite(code, req.user.id);
  }
}
