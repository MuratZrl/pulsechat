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
            _count: { select: { members: true, messages: true } },
          },
        },
      },
      orderBy: { room: { createdAt: 'asc' } },
    });

    return memberships.map((m) => ({
      id: m.room.id,
      name: m.room.name,
      createdBy: m.room.createdById,
      createdAt: m.room.createdAt.toISOString(),
      role: m.role,
      memberCount: m.room._count.members,
    }));
  }

  async createRoom(userId: string, dto: CreateRoomDto) {
    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        createdById: userId,
        members: {
          create: { userId, role: 'admin' },
        },
      },
    });
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdById,
      createdAt: room.createdAt.toISOString(),
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

    return {
      id: room.id,
      name: room.name,
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
    await this.prisma.roomMember.deleteMany({
      where: { userId, roomId },
    });
    return { success: true };
  }
}
