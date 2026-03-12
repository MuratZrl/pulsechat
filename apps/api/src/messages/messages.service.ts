import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

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
      attachment: msg.attachment ?? undefined,
      forwarded: msg.forwarded ?? undefined,
    };
  }

  async getMessages(
    roomId: string,
    userId: string,
    limit = 30,
    before?: string,
  ) {
    // Verify member
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
      include: { sender: { select: { id: true, name: true } } },
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
      include: { sender: { select: { id: true, name: true } } },
    });

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
      include: { sender: { select: { id: true, name: true } } },
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
      include: { sender: { select: { id: true, name: true } } },
    });

    return this.formatMessage(updated);
  }
}
