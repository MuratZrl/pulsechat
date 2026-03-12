import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';

type ReactionMap = Record<string, string[]>; // emoji -> userIds

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  private buildReactionMap(
    reactions: { emoji: string; userId: string }[],
  ): ReactionMap {
    const map: ReactionMap = {};
    for (const r of reactions) {
      if (!map[r.emoji]) map[r.emoji] = [];
      map[r.emoji].push(r.userId);
    }
    return map;
  }

  private formatMessage(msg: {
    id: string;
    roomId: string;
    senderId: string;
    text: string;
    createdAt: Date;
    editedAt: Date | null;
    isDeleted: boolean;
    replyToId: string | null;
    attachment: unknown;
    forwarded: unknown;
    sender: { id: string; name: string };
    reactions?: { emoji: string; userId: string }[];
    replyTo?: {
      id: string;
      text: string;
      isDeleted: boolean;
      sender: { name: string };
    } | null;
  }) {
    return {
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      text: msg.isDeleted ? '' : msg.text,
      createdAt: msg.createdAt.toISOString(),
      editedAt: msg.editedAt?.toISOString(),
      isDeleted: msg.isDeleted,
      replyToId: msg.replyToId ?? undefined,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            text: msg.replyTo.isDeleted ? '' : msg.replyTo.text,
            senderName: msg.replyTo.sender.name,
          }
        : undefined,
      attachment: msg.attachment ?? undefined,
      forwarded: msg.forwarded ?? undefined,
      reactions: this.buildReactionMap(msg.reactions ?? []),
    };
  }

  private readonly messageInclude = {
    sender: { select: { id: true, name: true } },
    reactions: { select: { emoji: true, userId: true } },
    replyTo: {
      select: {
        id: true,
        text: true,
        isDeleted: true,
        sender: { select: { name: true } },
      },
    },
  };

  async getMessages(
    roomId: string,
    userId: string,
    limit = 30,
    before?: string,
  ) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const take = limit + 1;
    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: this.messageInclude,
    });

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    return {
      messages: result.map((m) => this.formatMessage(m)),
      hasMore,
    };
  }

  async sendMessage(
    roomId: string,
    userId: string,
    dto: CreateMessageDto,
    senderName: string,
  ) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        text: dto.text,
        replyToId: dto.replyToId ?? null,
        attachment: dto.attachment ? (dto.attachment as object) : undefined,
        forwarded: dto.forwarded ? (dto.forwarded as object) : undefined,
      },
      include: this.messageInclude,
    });

    // Parse @mentions and store them
    const mentionPattern = /@(\w[\w ]*?\w|\w+)/g;
    const mentionedNames = [...dto.text.matchAll(mentionPattern)].map((m) =>
      m[1].toLowerCase(),
    );
    if (mentionedNames.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          name: { in: mentionedNames, mode: 'insensitive' },
          id: { not: userId },
          rooms: { some: { roomId } },
        },
        select: { id: true },
      });
      if (users.length > 0) {
        await this.prisma.mention.createMany({
          data: users.map((u) => ({ messageId: message.id, userId: u.id })),
          skipDuplicates: true,
        });
      }
    }

    return this.formatMessage(message);
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId)
      throw new ForbiddenException('Cannot edit others messages');
    if (message.isDeleted) throw new ForbiddenException('Message is deleted');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text: dto.text, editedAt: new Date() },
      include: this.messageInclude,
    });

    return this.formatMessage(updated);
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        room: { include: { members: { where: { userId } } } },
      },
    });
    if (!message) throw new NotFoundException('Message not found');

    const member = message.room.members[0];
    const isOwner = message.senderId === userId;
    const canDelete =
      isOwner || member?.role === 'admin' || member?.role === 'moderator';
    if (!canDelete) throw new ForbiddenException('Cannot delete this message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, text: '' },
      include: this.messageInclude,
    });

    return this.formatMessage(updated);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { roomId: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: message.roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });

    return {
      messageId,
      roomId: message.roomId,
      reactions: this.buildReactionMap(reactions),
    };
  }

  async getUnreadMentions(userId: string) {
    return this.prisma.mention.findMany({
      where: { userId, read: false },
      include: {
        message: {
          select: { id: true, roomId: true, text: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markMentionsRead(userId: string, roomId: string) {
    await this.prisma.mention.updateMany({
      where: { userId, read: false, message: { roomId } },
      data: { read: true },
    });
  }

  async getReceipts(
    messageIds: string[],
  ): Promise<Record<string, { userId: string; userName: string; readAt: string }[]>> {
    if (!messageIds.length) return {};

    const receipts = await this.prisma.readReceipt.findMany({
      where: { messageId: { in: messageIds } },
      include: { user: { select: { id: true, name: true } } },
    });

    const result: Record<string, { userId: string; userName: string; readAt: string }[]> = {};
    for (const r of receipts) {
      if (!result[r.messageId]) result[r.messageId] = [];
      result[r.messageId].push({
        userId: r.userId,
        userName: r.user.name,
        readAt: r.readAt.toISOString(),
      });
    }
    return result;
  }

  async searchMessages(roomId: string, userId: string, query: string, limit = 20) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        isDeleted: false,
        text: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.messageInclude,
    });

    return messages.map((m) => this.formatMessage(m));
  }
}
