import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async getRooms(userId: string) {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            _count: { select: { members: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
            members: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { room: { createdAt: 'asc' } },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            roomId: m.roomId,
            createdAt: { gt: m.lastReadAt },
            isDeleted: false,
            senderId: { not: userId },
          },
        });

        const mentionCount = await this.prisma.mention.count({
          where: { userId, read: false, message: { roomId: m.roomId } },
        });

        const displayName =
          m.room.type === 'DM'
            ? (m.room.members.find((mem) => mem.userId !== userId)?.user.name ??
              m.room.name)
            : m.room.name;

        return {
          id: m.room.id,
          name: displayName,
          type: m.room.type,
          createdBy: m.room.createdById,
          createdAt: m.room.createdAt.toISOString(),
          role: m.role,
          memberCount: m.room._count.members,
          unreadCount,
          mentionCount,
          lastMessageAt:
            m.room.messages[0]?.createdAt.toISOString() ?? null,
        };
      }),
    );
  }

  async createRoom(userId: string, dto: CreateRoomDto) {
    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        createdById: userId,
        members: { create: { userId, role: 'admin' } },
      },
    });
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      createdBy: room.createdById,
      createdAt: room.createdAt.toISOString(),
      unreadCount: 0,
      mentionCount: 0,
    };
  }

  async getRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this room');

    const displayName =
      room.type === 'DM'
        ? (room.members.find((m) => m.userId !== userId)?.user.name ?? room.name)
        : room.name;

    return {
      id: room.id,
      name: displayName,
      type: room.type,
      createdBy: room.createdById,
      createdAt: room.createdAt.toISOString(),
      members: room.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  async joinRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    await this.prisma.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId, role: 'member' },
      update: {},
    });
    return { success: true };
  }

  async leaveRoom(roomId: string, userId: string) {
    await this.prisma.roomMember.deleteMany({ where: { userId, roomId } });
    return { success: true };
  }

  async markRead(roomId: string, userId: string) {
    await this.prisma.roomMember.update({
      where: { userId_roomId: { userId, roomId } },
      data: { lastReadAt: new Date() },
    });
    await this.prisma.mention.updateMany({
      where: { userId, read: false, message: { roomId } },
      data: { read: true },
    });
    return { success: true };
  }

  // ─── Direct Messages ────────────────────────────────────────────────────────

  async getOrCreateDm(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId)
      throw new ForbiddenException('Cannot DM yourself');

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    // Find existing DM between exactly these two users
    const existing = await this.prisma.room.findFirst({
      where: {
        type: 'DM',
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: { _count: { select: { members: true } } },
    });

    if (existing && existing._count.members === 2) {
      return { id: existing.id, name: target.name, type: 'DM', isNew: false };
    }

    const room = await this.prisma.room.create({
      data: {
        name: `${currentUserId}__${targetUserId}`,
        type: 'DM',
        createdById: currentUserId,
        members: {
          create: [
            { userId: currentUserId, role: 'member' },
            { userId: targetUserId, role: 'member' },
          ],
        },
      },
    });

    return { id: room.id, name: target.name, type: 'DM', isNew: true };
  }

  async getUsers(currentUserId: string) {
    return this.prisma.user.findMany({
      where: { id: { not: currentUserId } },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });
  }
}
