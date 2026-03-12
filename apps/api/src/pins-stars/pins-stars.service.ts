import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PinsStarsService {
  constructor(private prisma: PrismaService) {}

  async togglePin(roomId: string, messageId: string, userId: string): Promise<string[]> {
    const existing = await this.prisma.pin.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing) {
      await this.prisma.pin.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.pin.create({ data: { messageId, userId, roomId } });
    }

    const pins = await this.prisma.pin.findMany({
      where: { roomId },
      select: { messageId: true },
    });
    return pins.map((p) => p.messageId);
  }

  async getPinnedIds(roomId: string): Promise<string[]> {
    const pins = await this.prisma.pin.findMany({
      where: { roomId },
      select: { messageId: true },
    });
    return pins.map((p) => p.messageId);
  }

  async toggleStar(messageId: string, userId: string, roomId: string): Promise<boolean> {
    const existing = await this.prisma.star.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing) {
      await this.prisma.star.delete({ where: { id: existing.id } });
      return false;
    } else {
      await this.prisma.star.create({ data: { messageId, userId, roomId } });
      return true;
    }
  }

  async getStarredIds(userId: string): Promise<string[]> {
    const stars = await this.prisma.star.findMany({
      where: { userId },
      select: { messageId: true },
    });
    return stars.map((s) => s.messageId);
  }

  async getStarredEntries(userId: string) {
    const stars = await this.prisma.star.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          select: {
            id: true,
            text: true,
            isDeleted: true,
            senderId: true,
            sender: { select: { name: true } },
          },
        },
        room: { select: { id: true, name: true, type: true } },
      },
    });

    return stars
      .filter((s) => !s.message.isDeleted)
      .map((s) => ({
        messageId: s.messageId,
        roomId: s.roomId,
        roomName: s.room.name,
        starredAt: s.createdAt.toISOString(),
        message: {
          id: s.message.id,
          text: s.message.text,
          senderName: s.message.sender.name,
        },
      }));
  }

  async toggleStarLookup(messageId: string, userId: string): Promise<boolean> {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { roomId: true },
    });
    if (!msg) return false;
    return this.toggleStar(messageId, userId, msg.roomId);
  }
}
