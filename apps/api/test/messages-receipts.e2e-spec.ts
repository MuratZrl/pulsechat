import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

describe('Messages getReceipts authorization (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenC: string;

  // ── In-memory stores ─────────────────────────────────────────────────────
  type StoredUser = { id: string; name: string; email: string };
  type StoredMember = { userId: string; roomId: string; role: string };
  type StoredMessage = { id: string; roomId: string; senderId: string };
  type StoredReceipt = { messageId: string; userId: string; readAt: Date };

  const users = new Map<string, StoredUser>();
  const roomMembers: StoredMember[] = [];
  const messages = new Map<string, StoredMessage>();
  const receipts: StoredReceipt[] = [];

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
    readReceipt: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            messageId?: { in: string[] };
            message?: { roomId: string };
          };
        }) => {
          const ids = where.messageId?.in ?? [];
          const wantRoom = where.message?.roomId;
          return receipts
            .filter((r) => ids.includes(r.messageId))
            .filter((r) => {
              if (!wantRoom) return true;
              const msg = messages.get(r.messageId);
              return msg?.roomId === wantRoom;
            })
            .map((r) => {
              const u = users.get(r.userId);
              return {
                messageId: r.messageId,
                userId: r.userId,
                readAt: r.readAt,
                user: u
                  ? { id: u.id, name: u.name }
                  : { id: r.userId, name: 'unknown' },
              };
            });
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

    // Seed: A and B share R1; C is alone in R2. M1 lives in R1, M2 in R2.
    // Receipts: A read M1, C read M2.
    users.set('user-A', { id: 'user-A', name: 'Alice', email: 'a@example.com' });
    users.set('user-B', { id: 'user-B', name: 'Bob', email: 'b@example.com' });
    users.set('user-C', { id: 'user-C', name: 'Carol', email: 'c@example.com' });

    roomMembers.push(
      { userId: 'user-A', roomId: 'room-R1', role: 'member' },
      { userId: 'user-B', roomId: 'room-R1', role: 'member' },
      { userId: 'user-C', roomId: 'room-R2', role: 'member' },
    );

    messages.set('msg-M1', { id: 'msg-M1', roomId: 'room-R1', senderId: 'user-A' });
    messages.set('msg-M2', { id: 'msg-M2', roomId: 'room-R2', senderId: 'user-C' });

    receipts.push(
      { messageId: 'msg-M1', userId: 'user-A', readAt: new Date('2026-01-01T00:00:00Z') },
      { messageId: 'msg-M2', userId: 'user-C', readAt: new Date('2026-01-02T00:00:00Z') },
    );

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
    tokenC = await jwt.signAsync(
      { sub: 'user-C', email: 'c@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    users.clear();
    roomMembers.length = 0;
    messages.clear();
    receipts.length = 0;
    if (app) await app.close();
  });

  // ── Scenarios ────────────────────────────────────────────────────────────

  it('returns receipts for an in-room message id when caller is a member', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: 'msg-M1' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body['msg-M1']).toEqual([
      {
        userId: 'user-A',
        userName: 'Alice',
        readAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('rejects a non-member with 403 "Not a member of this room"', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: 'msg-M1' })
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(403);

    expect(res.body.message).toBe('Not a member of this room');
  });

  it('drops cross-room message ids silently (no leak)', async () => {
    // A is a member of R1 but asks for M2 which lives in R2.
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: 'msg-M2' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toEqual({});
  });

  it('returns only the in-room receipt when the list mixes rooms', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: 'msg-M1,msg-M2' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Object.keys(res.body)).toEqual(['msg-M1']);
    expect(res.body['msg-M1']).toHaveLength(1);
    expect(res.body['msg-M1'][0].userId).toBe('user-A');
  });

  it('returns {} when ids is empty', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: '' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toEqual({});
  });

  it('rejects > 200 ids with 400 "Too many message ids"', async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => `msg-${i}`).join(',');
    const res = await request(app.getHttpServer())
      .get('/api/rooms/room-R1/receipts')
      .query({ ids: tooMany })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    expect(res.body.message).toBe('Too many message ids');
  });
});
