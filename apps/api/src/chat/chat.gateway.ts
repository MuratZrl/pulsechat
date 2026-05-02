import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { EditMessageDto } from '../messages/dto/edit-message.dto';
import { Injectable } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface AuthSocket extends Socket {
  userId: string;
  userName: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
@SkipThrottle()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private messagesService: MessagesService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Sliding-window rate limit per (action, user). Increments a counter in
   * Redis and sets a TTL on first hit; returns false once the counter
   * exceeds the limit until the window expires.
   */
  private async checkRateLimit(
    userId: string,
    action: string,
    limit: number,
    windowSeconds = 60,
  ): Promise<boolean> {
    const key = `rl:${action}:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return count <= limit;
  }

  async handleConnection(client: AuthSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');

      const payload = this.jwt.verify<{ sub: string; email: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true },
      });
      if (!user) throw new Error('User not found');

      client.userId = user.id;
      client.userName = user.name;

      // Per-user room — used by direct emits like `mention` so we can target
      // the user without knowing which sockets they currently have open.
      await client.join(`user:${user.id}`);

      // Auto-join all rooms the user is a member of
      const memberships = await this.prisma.roomMember.findMany({
        where: { userId: user.id },
        select: { roomId: true },
      });

      for (const { roomId } of memberships) {
        await client.join(roomId);
        client.to(roomId).emit('user_online', {
          userId: user.id,
          userName: user.name,
        });
      }

      for (const { roomId } of memberships) {
        await this.emitRoomUsers(roomId);
      }
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthSocket) {
    if (!client.userId) return;

    const memberships = await this.prisma.roomMember.findMany({
      where: { userId: client.userId },
      select: { roomId: true },
    });

    for (const { roomId } of memberships) {
      client.to(roomId).emit('user_offline', { userId: client.userId });
      await this.emitRoomUsers(roomId);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.join(data.roomId);
    await this.emitRoomUsers(data.roomId);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.leave(data.roomId);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: CreateMessageDto & { roomId: string },
  ) {
    if (!(await this.checkRateLimit(client.userId, 'msg', 30))) {
      throw new WsException('Rate limit exceeded — slow down');
    }
    try {
      const { roomId, ...dto } = data;
      const message = await this.messagesService.sendMessage(
        roomId,
        client.userId,
        dto,
        client.userName,
      );
      this.server.to(roomId).emit('new_message', message);

      // Notify mentioned users via their per-user room. (The previous
      // `if (message.reactions !== undefined)` guard was dead code — the
      // formatter always returns a reactions field — and the emit targeted
      // a room named after the userId that no socket had joined, so mention
      // events never reached the client.)
      const mentions = await this.prisma.mention.findMany({
        where: { messageId: message.id },
        select: { userId: true },
      });
      for (const { userId } of mentions) {
        this.server.to(`user:${userId}`).emit('mention', {
          roomId,
          messageId: message.id,
          fromName: client.userName,
          text: message.text,
        });
      }

      return { success: true, message };
    } catch (e: unknown) {
      throw new WsException(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string; text: string },
  ) {
    if (!(await this.checkRateLimit(client.userId, 'edit', 60))) {
      throw new WsException('Rate limit exceeded — slow down');
    }
    try {
      const dto: EditMessageDto = { text: data.text };
      const updated = await this.messagesService.editMessage(
        data.messageId,
        client.userId,
        dto,
      );
      this.server.to(updated.roomId).emit('message_edited', {
        messageId: updated.id,
        text: updated.text,
        editedAt: updated.editedAt,
      });
      return { success: true };
    } catch (e: unknown) {
      throw new WsException(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const deleted = await this.messagesService.deleteMessage(
        data.messageId,
        client.userId,
      );
      this.server.to(deleted.roomId).emit('message_deleted', {
        messageId: deleted.id,
      });
      return { success: true };
    } catch (e: unknown) {
      throw new WsException(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  @SubscribeMessage('toggle_reaction')
  async handleToggleReaction(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    if (!(await this.checkRateLimit(client.userId, 'reaction', 60))) {
      throw new WsException('Rate limit exceeded — slow down');
    }
    try {
      const result = await this.messagesService.toggleReaction(
        data.messageId,
        client.userId,
        data.emoji,
      );
      // Broadcast updated reactions to everyone in the room
      this.server.to(result.roomId).emit('reaction_updated', {
        messageId: result.messageId,
        reactions: result.reactions,
      });
      return { success: true };
    } catch (e: unknown) {
      throw new WsException(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string; roomId: string },
  ) {
    await this.prisma.readReceipt.upsert({
      where: { messageId_userId: { messageId: data.messageId, userId: client.userId } },
      create: { messageId: data.messageId, userId: client.userId },
      update: { readAt: new Date() },
    });
    this.server.to(data.roomId).emit('read_receipt', {
      messageId: data.messageId,
      userId: client.userId,
      userName: client.userName,
      readAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    client.to(data.roomId).emit('user_typing', {
      roomId: data.roomId,
      userId: client.userId,
      userName: client.userName,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    client.to(data.roomId).emit('user_stop_typing', {
      roomId: data.roomId,
      userId: client.userId,
    });
  }

  private async emitRoomUsers(roomId: string) {
    const sockets = await this.server.in(roomId).fetchSockets();
    const onlineUserIds = new Set(
      sockets.map((s) => (s as unknown as AuthSocket).userId),
    );

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { id: true, name: true } } },
    });

    const users = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      status: onlineUserIds.has(m.user.id)
        ? ('online' as const)
        : ('offline' as const),
    }));

    this.server.to(roomId).emit('room_users', { roomId, users });
  }
}
