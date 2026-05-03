import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

describe('Pins authorization (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;

  // ── In-memory stores ─────────────────────────────────────────────────────
  type StoredUser = { id: string; name: string; email: string };
  type StoredMember = { userId: string; roomId: string; role: string };
  type StoredMessage = { id: string; roomId: string; senderId: string };
  type StoredPin = { messageId: string; userId: string; roomId: string };

  const users = new Map<string, StoredUser>();
  const roomMembers: StoredMember[] = [];
  const messages = new Map<string, StoredMessage>();
  const pins: StoredPin[] = [];

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
          if (where?.id) u = users.get(where.id);
          else if (where?.email)
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
    },
    roomMember: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { userId_roomId: { userId: string; roomId: string } };
        }) =>
          roomMembers.find(
            (m) =>
              m.userId === where.userId_roomId.userId &&
              m.roomId === where.userId_roomId.roomId,
          ) ?? null,
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
    },
    pin: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { roomId?: string; userId?: string };
        }) =>
          pins
            .filter((p) =>
              where.roomId === undefined ? true : p.roomId === where.roomId,
            )
            .filter((p) =>
              where.userId === undefined ? true : p.userId === where.userId,
            )
            .map((p) => ({ messageId: p.messageId })),
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { messageId: string; userId: string; roomId: string };
        }) => {
          const exists = pins.some(
            (p) => p.messageId === data.messageId && p.userId === data.userId,
          );
          if (exists) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed',
              { code: 'P2002', clientVersion: 'test' },
            );
          }
          pins.push({ ...data });
          return { id: `pin-${pins.length}`, ...data };
        },
      ),
      deleteMany: jest.fn(
        async ({
          where,
        }: {
          where: { messageId: string; userId: string; roomId?: string };
        }) => {
          let count = 0;
          for (let i = pins.length - 1; i >= 0; i--) {
            if (
              pins[i].messageId === where.messageId &&
              pins[i].userId === where.userId &&
              (where.roomId === undefined || pins[i].roomId === where.roomId)
            ) {
              pins.splice(i, 1);
              count++;
            }
          }
          return { count };
        },
      ),
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

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-e2e';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    users.set('user-A', { id: 'user-A', name: 'Alice', email: 'a@example.com' });
    users.set('user-B', { id: 'user-B', name: 'Bob', email: 'b@example.com' });

    // A is in both R1 and R2 — needed to set up the cross-room attack scenario
    // where the message id A passes is one A could legitimately read.
    roomMembers.push(
      { userId: 'user-A', roomId: 'room-R1', role: 'member' },
      { userId: 'user-A', roomId: 'room-R2', role: 'member' },
    );

    messages.set('msg-M1', { id: 'msg-M1', roomId: 'room-R1', senderId: 'user-A' });
    messages.set('msg-M2', { id: 'msg-M2', roomId: 'room-R2', senderId: 'user-A' });

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
    await app.init();

    const jwt = app.get(JwtService);
    tokenA = await jwt.signAsync(
      { sub: 'user-A', email: 'a@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
    tokenB = await jwt.signAsync(
      { sub: 'user-B', email: 'b@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    users.clear();
    roomMembers.length = 0;
    messages.clear();
    pins.length = 0;
    if (app) await app.close();
  });

  // ── Scenarios ────────────────────────────────────────────────────────────

  it('pins a message that belongs to the supplied room', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages/msg-M1/pin')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(res.body).toContain('msg-M1');
    expect(pins).toHaveLength(1);
    expect(pins[0]).toEqual({
      messageId: 'msg-M1',
      userId: 'user-A',
      roomId: 'room-R1',
    });
  });

  it('rejects pinning a message from a different room with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages/msg-M2/pin')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    expect(res.body.message).toBe('Message does not belong to this room');
    // No new pin row written
    const leaked = pins.some(
      (p) => p.messageId === 'msg-M2' && p.roomId === 'room-R1',
    );
    expect(leaked).toBe(false);
  });

  it('returns 404 for a non-existent message id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages/non-existent/pin')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    expect(res.body.message).toBe('Message not found');
  });

  it('toggles the pin off on a second call', async () => {
    // M1 was pinned in the first scenario. Toggling again removes it.
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages/msg-M1/pin')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(res.body).not.toContain('msg-M1');
    expect(pins.find((p) => p.messageId === 'msg-M1')).toBeUndefined();
  });

  it('rejects a non-member with 403 before checking the message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages/msg-M1/pin')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    expect(res.body.message).toBe('Not a member of this room');
  });
});
