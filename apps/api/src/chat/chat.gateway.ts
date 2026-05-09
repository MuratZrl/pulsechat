import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
import { Injectable, Logger } from '@nestjs/common';
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
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

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

  private async assertMember(userId: string, roomId: string): Promise<void> {
    if (!roomId || typeof roomId !== 'string') {
      throw new WsException('Invalid roomId');
    }
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) {
      throw new WsException('Not a member of this room');
    }
  }

  /**
   * Connection-time auth gate. Runs as socket.io middleware, so it executes
   * before any @SubscribeMessage handler can fire — no race window where
   * client.userId is undefined while a queued event tries to use it.
   * Failed auth rejects the connection outright; successful auth attaches
   * userId/userName to the socket once, synchronously from the middleware's
   * perspective.
   */
  afterInit(server: Server): void {
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) return next(new Error('No token'));

        const payload = this.jwt.verify<{ sub: string; email: string }>(token, {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
        });

        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, name: true },
        });
        if (!user) return next(new Error('User not found'));

        const authSocket = socket as AuthSocket;
        authSocket.userId = user.id;
        authSocket.userName = user.name;

        next();
      } catch (err) {
        this.logger.warn(
          `WS auth rejected: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: AuthSocket) {
    // Auth ran in middleware — client.userId and client.userName are
    // guaranteed set by the time we get here. This handler is now just the
    // post-auth setup: join the per-user room, auto-join every channel the
    // user belongs to, and broadcast presence.
    try {
      // Per-user room — used by direct emits like `mention` so we can target
      // the user without knowing which sockets they currently have open.
      await client.join(`user:${client.userId}`);

      const memberships = await this.prisma.roomMember.findMany({
        where: { userId: client.userId },
        select: { roomId: true },
      });

      for (const { roomId } of memberships) {
        await client.join(roomId);
        client.to(roomId).emit('user_online', {
          userId: client.userId,
          userName: client.userName,
        });
      }

      for (const { roomId } of memberships) {
        await this.emitRoomUsers(roomId);
      }

      this.logger.debug(
        `User ${client.userId} (${client.userName}) connected`,
      );
    } catch (err) {
      this.logger.warn(
        `WS post-auth setup failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
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
    // Rate-limit before the DB lookup so a spammy client can't force a query
    // per emit.
    if (!(await this.checkRateLimit(client.userId, 'join', 30))) {
      throw new WsException('Rate limit exceeded — slow down');
    }
    await this.assertMember(client.userId, data.roomId);
    await client.join(data.roomId);
    await this.emitRoomUsers(data.roomId);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    // No assertMember: leaving must succeed even after the user was removed
    // from RoomMember (HTTP leaveRoom or kick) so the socket can still detach.
    if (!data.roomId || typeof data.roomId !== 'string') return;
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
      //
      // Self-mention rows exist in DB now (the renderer needs them to paint
      // the author's own @-name as a pill), but we still skip the
      // notification emit for the author's own row — they shouldn't get a
      // toast/sound for tagging themselves.
      const mentions = await this.prisma.mention.findMany({
        where: { messageId: message.id },
        select: { userId: true },
      });
      for (const { userId: mentionedUserId } of mentions) {
        if (mentionedUserId === client.userId) continue;
        this.server.to(`user:${mentionedUserId}`).emit('mention', {
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
    // Read receipts are best-effort UX — a fast scroll can legitimately trip
    // the limiter, so silently drop instead of throwing.
    if (!(await this.checkRateLimit(client.userId, 'read', 120))) return;
    if (!data.messageId || !data.roomId) return;
    await this.assertMember(client.userId, data.roomId);
    const message = await this.prisma.message.findUnique({
      where: { id: data.messageId },
      select: { roomId: true },
    });
    if (!message || message.roomId !== data.roomId) {
      throw new WsException('Message does not belong to this room');
    }
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
  async handleTypingStart(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    // Silent drop on limit — typing pings are noisy and non-critical.
    if (!(await this.checkRateLimit(client.userId, 'typing', 60))) return;
    await this.assertMember(client.userId, data.roomId);
    client.to(data.roomId).emit('user_typing', {
      roomId: data.roomId,
      userId: client.userId,
      userName: client.userName,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { roomId: string },
  ) {
    // No assertMember: typing_stop is a cleanup signal that must broadcast
    // even if the user was just kicked while typing.
    if (!data.roomId || typeof data.roomId !== 'string') return;
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
