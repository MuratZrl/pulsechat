import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

describe('Chat gateway authorization (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let tokenA: string;
  let tokenB: string;

  // ── In-memory stores backing the Prisma mock ─────────────────────────────
  type StoredUser = { id: string; name: string; email: string };
  type StoredMember = { userId: string; roomId: string; role: string };
  type StoredMessage = {
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
  };

  const users = new Map<string, StoredUser>();
  const roomMembers: StoredMember[] = [];
  const messages = new Map<string, StoredMessage>();
  let messageIdSeq = 0;

  const findMember = (userId: string, roomId: string): StoredMember | null =>
    roomMembers.find((m) => m.userId === userId && m.roomId === roomId) ?? null;

  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    user: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: string; email?: string };
          select?: Record<string, unknown>;
        }) => {
          let u: StoredUser | undefined;
          if (where.id) u = users.get(where.id);
          else if (where.email)
            u = [...users.values()].find((x) => x.email === where.email);
          if (!u) return null;
          if (select) {
            const out: Record<string, unknown> = {};
            if (select.id) out.id = u.id;
            if (select.name) out.name = u.name;
            if (select.email) out.email = u.email;
            return out;
          }
          return u;
        },
      ),
      findMany: jest.fn(async () => []),
    },
    roomMember: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { userId_roomId: { userId: string; roomId: string } };
        }) => findMember(where.userId_roomId.userId, where.userId_roomId.roomId),
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
        }: {
          where?: { userId?: string; roomId?: string };
          include?: { user?: unknown };
        }) => {
          const filtered = roomMembers.filter(
            (m) =>
              (where?.userId === undefined || m.userId === where.userId) &&
              (where?.roomId === undefined || m.roomId === where.roomId),
          );
          if (include?.user) {
            return filtered.map((m) => {
              const u = users.get(m.userId);
              return {
                ...m,
                user: u ? { id: u.id, name: u.name } : null,
              };
            });
          }
          return filtered;
        },
      ),
    },
    message: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id: string };
          select?: { roomId?: boolean };
        }) => {
          const m = messages.get(where.id);
          if (!m) return null;
          if (select?.roomId) return { roomId: m.roomId };
          return m;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            roomId: string;
            senderId: string;
            text: string;
            replyToId?: string | null;
            attachment?: unknown;
            forwarded?: unknown;
          };
        }) => {
          const id = `msg-${++messageIdSeq}`;
          const sender = users.get(data.senderId);
          const stored: StoredMessage = {
            id,
            roomId: data.roomId,
            senderId: data.senderId,
            text: data.text,
            createdAt: new Date(),
            editedAt: null,
            isDeleted: false,
            replyToId: data.replyToId ?? null,
            attachment: data.attachment ?? null,
            forwarded: data.forwarded ?? null,
          };
          messages.set(id, stored);
          return {
            ...stored,
            sender: sender
              ? { id: sender.id, name: sender.name }
              : { id: data.senderId, name: 'unknown' },
            reactions: [],
            replyTo: null,
          };
        },
      ),
    },
    mention: {
      findMany: jest.fn(async () => []),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    readReceipt: {
      upsert: jest.fn(async () => ({})),
    },
  };

  const mockRedis = {
    incr: jest.fn(async () => 1),
    expire: jest.fn(async () => undefined),
    set: jest.fn(async () => undefined),
    get: jest.fn(async () => null),
    del: jest.fn(async () => undefined),
    ping: jest.fn(async () => 'PONG'),
    onModuleDestroy: jest.fn(),
  };

  const mockEmail = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };

  let sockA: ClientSocket;
  let sockB: ClientSocket;

  // ── Bootstrap ────────────────────────────────────────────────────────────
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-e2e';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    // Seed: A and B exist; only A is a member of CHANNEL room R1.
    users.set('user-A', { id: 'user-A', name: 'Alice', email: 'a@example.com' });
    users.set('user-B', { id: 'user-B', name: 'Bob', email: 'b@example.com' });
    roomMembers.push({ userId: 'user-A', roomId: 'room-R1', role: 'member' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .overrideProvider(EmailService)
      .useValue(mockEmail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0, '127.0.0.1');

    const addr = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${addr.port}`;

    const jwt = app.get(JwtService);
    tokenA = await jwt.signAsync(
      { sub: 'user-A', email: 'a@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
    tokenB = await jwt.signAsync(
      { sub: 'user-B', email: 'b@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );

    sockA = await connectClient(tokenA);
    sockB = await connectClient(tokenB);

    // Wait for handleConnection to fully run (auto-join + emitRoomUsers).
    // sockA gets a `room_users` for R1 once auto-join finishes; sockB has no
    // rooms so we just settle on a tick.
    await Promise.all([
      onceWithin<unknown>(sockA, 'room_users', 2000),
      new Promise((r) => setTimeout(r, 50)),
    ]);
  });

  afterAll(async () => {
    sockA?.disconnect();
    sockB?.disconnect();
    users.clear();
    roomMembers.length = 0;
    messages.clear();
    if (app) await app.close();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function connectClient(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const sock = ioClient(url, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      const onErr = (err: Error) => {
        sock.off('connect', onConn);
        reject(err);
      };
      const onConn = () => {
        sock.off('connect_error', onErr);
        resolve(sock);
      };
      sock.once('connect', onConn);
      sock.once('connect_error', onErr);
    });
  }

  function onceWithin<T>(
    sock: ClientSocket,
    event: string,
    ms: number,
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        sock.off(event, handler);
        resolve(null);
      }, ms);
      const handler = (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      };
      sock.once(event, handler);
    });
  }

  function emitWithAck<T>(
    sock: ClientSocket,
    event: string,
    data: unknown,
    ms = 2000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ack timeout for ${event}`)),
        ms,
      );
      sock.emit(event, data, (response: T) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  // ── Scenarios ────────────────────────────────────────────────────────────

  it('rejects join_room from a non-member with WsException "Not a member of this room"', async () => {
    const errPromise = onceWithin<{ message: string; status?: string }>(
      sockB,
      'exception',
      2000,
    );
    sockB.emit('join_room', { roomId: 'room-R1' });
    const err = await errPromise;
    expect(err).not.toBeNull();
    expect(err!.message).toBe('Not a member of this room');
  });

  it('does not deliver new_message to a non-member who tried to join', async () => {
    const newMsgPromise = onceWithin(sockB, 'new_message', 500);
    const ack = await emitWithAck<{ success: boolean; message: { id: string } }>(
      sockA,
      'send_message',
      { roomId: 'room-R1', text: 'hello R1' },
    );
    expect(ack.success).toBe(true);
    expect(ack.message.id).toBeDefined();

    const got = await newMsgPromise;
    expect(got).toBeNull();
  });

  it('rejects mark_read from a non-member with WsException "Not a member of this room"', async () => {
    // Need a real message in R1 first — A sends one over the socket.
    const ack = await emitWithAck<{ success: boolean; message: { id: string } }>(
      sockA,
      'send_message',
      { roomId: 'room-R1', text: 'mark me' },
    );
    const messageId = ack.message.id;

    const errPromise = onceWithin<{ message: string }>(
      sockB,
      'exception',
      2000,
    );
    sockB.emit('mark_read', { messageId, roomId: 'room-R1' });
    const err = await errPromise;
    expect(err).not.toBeNull();
    expect(err!.message).toBe('Not a member of this room');
  });

  it('does not deliver typing_start broadcast for a non-member', async () => {
    const typingPromise = onceWithin(sockA, 'user_typing', 500);
    sockB.emit('typing_start', { roomId: 'room-R1' });
    const got = await typingPromise;
    expect(got).toBeNull();
  });

  it('lets a kicked user leave_room without throwing', async () => {
    // Simulate a kick: drop A's RoomMember row directly while A's socket is
    // still open.
    const idx = roomMembers.findIndex(
      (m) => m.userId === 'user-A' && m.roomId === 'room-R1',
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    roomMembers.splice(idx, 1);

    const errPromise = onceWithin<{ message: string }>(sockA, 'exception', 500);
    sockA.emit('leave_room', { roomId: 'room-R1' });
    const err = await errPromise;
    expect(err).toBeNull();
  });

  it('lets a kicked user typing_stop without throwing', async () => {
    // A is no longer a member after the previous test's kick — typing_stop
    // must still be accepted as a cleanup signal.
    const errPromise = onceWithin<{ message: string }>(sockA, 'exception', 500);
    sockA.emit('typing_stop', { roomId: 'room-R1' });
    const err = await errPromise;
    expect(err).toBeNull();
  });
});
