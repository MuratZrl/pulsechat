import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Lets HTTP-side services act on live sockets without depending on the
 * gateway itself (ChatModule imports AuthModule, so injecting ChatGateway
 * into AuthService or RoomsService would be circular). ChatGateway registers
 * its server in afterInit. Every call targets the per-user `user:{id}` room
 * the gateway joins on connect, so it reaches all of that user's sockets on
 * every replica through the Redis adapter.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  /** Subscribe every live socket of `userId` to `roomId`. */
  joinRoom(userId: string, roomId: string): void {
    this.server?.in(`user:${userId}`).socketsJoin(roomId);
  }

  /** Unsubscribe every live socket of `userId` from `roomId`. */
  leaveRoom(userId: string, roomId: string): void {
    this.server?.in(`user:${userId}`).socketsLeave(roomId);
  }

  /**
   * Close every live socket of `userId`. Used when their sessions are
   * revoked (logout, password change/reset, account deletion) so a socket
   * authenticated earlier doesn't keep reading and posting.
   */
  disconnectUser(userId: string): void {
    this.server?.in(`user:${userId}`).disconnectSockets(true);
  }
}
