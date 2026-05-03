import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

describe('Rooms authorization (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  // ── In-memory stores ─────────────────────────────────────────────────────
  type StoredUser = { id: string; name: string; email: string };
  type StoredRoom = {
    id: string;
    name: string;
    type: 'GROUP' | 'DM';
    createdById: string;
    createdAt: Date;
  };
  type StoredMember = {
    userId: string;
    roomId: string;
    role: string;
    lastReadAt: Date;
    joinedAt: Date;
  };

  const users = new Map<string, StoredUser>();
  const rooms = new Map<string, StoredRoom>();
  const roomMembers: StoredMember[] = [];
  let roomIdSeq = 0;

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
    room: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id: string };
          select?: Record<string, unknown>;
        }) => {
          const r = rooms.get(where.id);
          if (!r) return null;
          if (select) {
            const out: Record<string, unknown> = {};
            if (select.id) out.id = r.id;
            if (select.name) out.name = r.name;
            if (select.type) out.type = r.type;
            return out;
          }
          return r;
        },
      ),
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { type?: string; AND?: Array<{ members: { some: { userId: string } } }> };
        }) => {
          const candidates = [...rooms.values()].filter((r) =>
            where.type === undefined ? true : r.type === where.type,
          );
          for (const r of candidates) {
            const memberIds = roomMembers
              .filter((m) => m.roomId === r.id)
              .map((m) => m.userId);
            const allMatch = (where.AND ?? []).every((cond) =>
              memberIds.includes(cond.members.some.userId),
            );
            if (allMatch) {
              return { ...r, _count: { members: memberIds.length } };
            }
          }
          return null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            name: string;
            type?: 'GROUP' | 'DM';
            createdById: string;
            members?: { create: { userId: string; role: string } | { userId: string; role: string }[] };
          };
        }) => {
          const id = `room-${++roomIdSeq}`;
          const room: StoredRoom = {
            id,
            name: data.name,
            type: data.type ?? 'GROUP',
            createdById: data.createdById,
            createdAt: new Date(),
          };
          rooms.set(id, room);
          if (data.members?.create) {
            const list = Array.isArray(data.members.create)
              ? data.members.create
              : [data.members.create];
            for (const m of list) {
              roomMembers.push({
                userId: m.userId,
                roomId: id,
                role: m.role,
                lastReadAt: new Date(0),
                joinedAt: new Date(),
              });
            }
          }
          return room;
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
      upsert: jest.fn(
        async ({
          where,
          create,
        }: {
          where: { userId_roomId: { userId: string; roomId: string } };
          create: { userId: string; roomId: string; role: string };
        }) => {
          const existing = roomMembers.find(
            (m) =>
              m.userId === where.userId_roomId.userId &&
              m.roomId === where.userId_roomId.roomId,
          );
          if (existing) return existing;
          const fresh: StoredMember = {
            userId: create.userId,
            roomId: create.roomId,
            role: create.role,
            lastReadAt: new Date(0),
            joinedAt: new Date(),
          };
          roomMembers.push(fresh);
          return fresh;
        },
      ),
      update: jest.fn(async () => ({})),
      deleteMany: jest.fn(
        async ({ where }: { where: { userId: string; roomId: string } }) => {
          let count = 0;
          for (let i = roomMembers.length - 1; i >= 0; i--) {
            if (
              roomMembers[i].userId === where.userId &&
              roomMembers[i].roomId === where.roomId
            ) {
              roomMembers.splice(i, 1);
              count++;
            }
          }
          return { count };
        },
      ),
    },
    roomInvite: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async () => ({ code: 'invite-stub' })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    mention: {
      updateMany: jest.fn(async () => ({ count: 0 })),
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

  // Helpers to seed state directly (bypassing service layer)
  const seedUser = (id: string, name: string, email: string) => {
    users.set(id, { id, name, email });
  };
  const seedRoom = (
    id: string,
    name: string,
    type: 'GROUP' | 'DM',
    createdById: string,
    memberSpecs: { userId: string; role: string }[],
  ) => {
    rooms.set(id, {
      id,
      name,
      type,
      createdById,
      createdAt: new Date(),
    });
    for (const m of memberSpecs) {
      roomMembers.push({
        userId: m.userId,
        roomId: id,
        role: m.role,
        lastReadAt: new Date(0),
        joinedAt: new Date(),
      });
    }
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-e2e';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    seedUser('user-A', 'Alice', 'a@example.com');
    seedUser('user-B', 'Bob', 'b@example.com');
    seedUser('user-C', 'Carol', 'c@example.com');

    // Seed `General` (joinable by anyone) — note we keep `Random` unused so
    // the public-default carve-out is visible without making every test pass
    // for the wrong reason.
    seedRoom('room-general', 'General', 'GROUP', 'user-A', []);

    // Private channel owned by A — B should be denied here.
    seedRoom('room-private', 'private-team', 'GROUP', 'user-A', [
      { userId: 'user-A', role: 'admin' },
    ]);

    // DM between A and C — B is unrelated.
    seedRoom('room-dm-ac', 'user-A__user-C', 'DM', 'user-A', [
      { userId: 'user-A', role: 'member' },
      { userId: 'user-C', role: 'member' },
    ]);

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
    const sign = (sub: string, email: string) =>
      jwt.signAsync(
        { sub, email },
        { secret: process.env.JWT_SECRET, expiresIn: '15m' },
      );
    tokenA = await sign('user-A', 'a@example.com');
    tokenB = await sign('user-B', 'b@example.com');
    tokenC = await sign('user-C', 'c@example.com');
  });

  afterAll(async () => {
    users.clear();
    rooms.clear();
    roomMembers.length = 0;
    if (app) await app.close();
  });

  // ── Scenarios ────────────────────────────────────────────────────────────

  it('blocks join on a private (non-default) channel with the invite message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-private/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    expect(res.body.message).toBe('This room requires an invite to join');
  });

  it('blocks join on a DM with the DM-specific message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-dm-ac/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    expect(res.body.message).toBe('Direct messages cannot be joined directly');
  });

  it('blocks leave on a DM (preserves history)', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/rooms/room-dm-ac/leave')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    expect(res.body.message).toBe('Direct messages cannot be left');

    // Confirm A is still a member of the DM
    const stillMember = roomMembers.some(
      (m) => m.userId === 'user-A' && m.roomId === 'room-dm-ac',
    );
    expect(stillMember).toBe(true);
  });

  it('blocks markRead from a non-member with 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-private/read')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    expect(res.body.message).toBe('Not a member of this room');
  });

  it('blocks generateInvite on a DM-typed room with 403', async () => {
    // Construct a DM-typed room where A is admin (synthetic edge case).
    seedRoom('room-dm-bogus', 'bogus__dm', 'DM', 'user-A', [
      { userId: 'user-A', role: 'admin' },
    ]);

    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-dm-bogus/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    expect(res.body.message).toBe('Direct messages cannot have invite links');
  });

  it('still allows joining the public-default General channel', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-general/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    const isMember = roomMembers.some(
      (m) => m.userId === 'user-B' && m.roomId === 'room-general',
    );
    expect(isMember).toBe(true);
  });

  it('keeps the DM accessible to its members after the failed join', async () => {
    // Sanity: C (a real DM member) was never affected by B's join attempt.
    void tokenC;
    const cIsMember = roomMembers.some(
      (m) => m.userId === 'user-C' && m.roomId === 'room-dm-ac',
    );
    expect(cIsMember).toBe(true);
    const bIsMember = roomMembers.some(
      (m) => m.userId === 'user-B' && m.roomId === 'room-dm-ac',
    );
    expect(bIsMember).toBe(false);
  });
});
