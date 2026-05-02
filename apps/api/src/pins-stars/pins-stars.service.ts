import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PinsStarsService {
  constructor(private prisma: PrismaService) {}

  private async assertMember(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');
  }

  async togglePin(roomId: string, messageId: string, userId: string): Promise<string[]> {
    await this.assertMember(userId, roomId);

    // Atomic toggle: try to insert; on unique-constraint violation the row
    // already exists, so delete it instead. Replaces the racy find-then-
    // create/delete pattern that crashed with 500 on a fast double-click.
    try {
      await this.prisma.pin.create({ data: { messageId, userId, roomId } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        await this.prisma.pin.deleteMany({ where: { messageId, userId } });
      } else {
        throw err;
      }
    }

    const pins = await this.prisma.pin.findMany({
      where: { roomId },
      select: { messageId: true },
    });
    return pins.map((p) => p.messageId);
  }

  async getPinnedIds(roomId: string, userId: string): Promise<string[]> {
    await this.assertMember(userId, roomId);
    const pins = await this.prisma.pin.findMany({
      where: { roomId },
      select: { messageId: true },
    });
    return pins.map((p) => p.messageId);
  }

  async toggleStar(messageId: string, userId: string, roomId: string): Promise<boolean> {
    // Atomic toggle: try to insert (return true). On unique-constraint
    // violation the row already exists, so delete it (return false).
    try {
      await this.prisma.star.create({ data: { messageId, userId, roomId } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        await this.prisma.star.deleteMany({ where: { messageId, userId } });
        return false;
      }
      throw err;
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

    // Stars are personal but the act of starring still touches a message
    // the user shouldn't be able to enumerate by id. Require membership.
    await this.assertMember(userId, msg.roomId);

    return this.toggleStar(messageId, userId, msg.roomId);
  }
}
