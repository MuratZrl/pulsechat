import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

// Channels joinable through POST /rooms/:id/join without an invite. Every
// other channel is invite-only; DMs are not joinable through this path at all.
const PUBLIC_DEFAULTS = new Set(['General', 'Random']);

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

    const myMembership = room.members.find((m) => m.userId === userId);
    if (!myMembership) throw new ForbiddenException('Not a member of this room');

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
      // The viewer's own RoomMember.lastReadAt — used by the chat page to
      // anchor an unread-message separator above the first message newer
      // than this timestamp. Snapshotted client-side on page load so the
      // separator stays put even after the room's mark-read fires later.
      lastReadAt: myMembership.lastReadAt.toISOString(),
      members: room.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  // Channels are invite-only by default. The only ones joinable via this path
  // are the seeded `General` / `Random` defaults; everything else routes
  // through joinByInvite. DMs are 2-party by definition and are never joinable
  // through this endpoint.
  async joinRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, name: true, type: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.type === 'DM') {
      throw new ForbiddenException('Direct messages cannot be joined directly');
    }
    if (!PUBLIC_DEFAULTS.has(room.name)) {
      throw new ForbiddenException('This room requires an invite to join');
    }
    await this.prisma.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId, role: 'member' },
      update: {},
    });
    return { success: true };
  }

  // Leaving a DM would orphan its history: getOrCreateDm only matches rooms
  // with both members still present, so the next message between the same
  // two users would create a fresh DM and the old one becomes unreachable.
  async leaveRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { type: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.type === 'DM') {
      throw new ForbiddenException('Direct messages cannot be left');
    }
    await this.prisma.roomMember.deleteMany({ where: { userId, roomId } });
    return { success: true };
  }

  async markRead(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

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

  // ─── Invite Links ──────────────────────────────────────────────────────────

  async getInvite(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const invite = await this.prisma.roomInvite.findUnique({
      where: { roomId },
    });
    return { code: invite?.code ?? null };
  }

  async generateInvite(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { type: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.type === 'DM') {
      throw new ForbiddenException('Direct messages cannot have invite links');
    }

    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');
    if (member.role === 'member')
      throw new ForbiddenException('Only admins and moderators can create invites');

    // Delete existing, then create fresh invite
    await this.prisma.roomInvite.deleteMany({ where: { roomId } });
    const invite = await this.prisma.roomInvite.create({
      data: { roomId, createdById: userId },
    });
    return { code: invite.code };
  }

  async revokeInvite(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');
    if (member.role === 'member')
      throw new ForbiddenException('Only admins and moderators can revoke invites');

    await this.prisma.roomInvite.deleteMany({ where: { roomId } });
    return { success: true };
  }

  async joinByInvite(code: string, userId: string) {
    const invite = await this.prisma.roomInvite.findUnique({
      where: { code },
      include: { room: { select: { id: true, name: true, type: true } } },
    });
    if (!invite) throw new NotFoundException('Invalid or expired invite code');
    // Reuse the unknown-code message so a probe can't tell whether the code
    // exists but points at a DM.
    if (invite.room.type === 'DM') {
      throw new NotFoundException('Invalid or expired invite code');
    }

    await this.prisma.roomMember.upsert({
      where: { userId_roomId: { userId, roomId: invite.roomId } },
      create: { userId, roomId: invite.roomId, role: 'member' },
      update: {},
    });

    return { roomId: invite.roomId, roomName: invite.room.name, type: invite.room.type };
  }
}
