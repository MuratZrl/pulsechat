import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { PinsStarsService } from './pins-stars.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class PinsStarsController {
  constructor(private pinsStarsService: PinsStarsService) {}

  @Get('rooms/:roomId/pins')
  getPins(@Param('roomId') roomId: string) {
    return this.pinsStarsService.getPinnedIds(roomId);
  }

  @Post('rooms/:roomId/messages/:messageId/pin')
  togglePin(
    @Request() req: { user: { id: string } },
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.pinsStarsService.togglePin(roomId, messageId, req.user.id);
  }

  @Get('stars')
  getStars(@Request() req: { user: { id: string } }) {
    return this.pinsStarsService.getStarredEntries(req.user.id);
  }

  @Post('messages/:messageId/star')
  toggleStar(
    @Request() req: { user: { id: string } },
    @Param('messageId') messageId: string,
  ) {
    // We need roomId — look it up from the message
    return this.pinsStarsService.toggleStarLookup(messageId, req.user.id);
  }
}
