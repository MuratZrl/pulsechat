import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

const R2_PUBLIC_URL = 'https://test-r2.example';

describe('Messages validation (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;

  // ── In-memory stores ─────────────────────────────────────────────────────
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
      findMany: jest.fn(async () => []),
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
          select?: { roomId?: boolean; isDeleted?: boolean };
        }) => {
          const m = messages.get(where.id);
          if (!m) return null;
          if (select) {
            const out: Record<string, unknown> = {};
            if (select.roomId) out.roomId = m.roomId;
            if (select.isDeleted) out.isDeleted = m.isDeleted;
            return out;
          }
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

          // Build the parent's `replyTo` payload if present, mimicking
          // Prisma's nested include shape.
          const replyTo = stored.replyToId
            ? (() => {
                const parent = messages.get(stored.replyToId!);
                if (!parent) return null;
                const parentSender = users.get(parent.senderId);
                return {
                  id: parent.id,
                  text: parent.text,
                  isDeleted: parent.isDeleted,
                  sender: { name: parentSender?.name ?? 'unknown' },
                };
              })()
            : null;

          return {
            ...stored,
            sender: sender
              ? { id: sender.id, name: sender.name }
              : { id: data.senderId, name: 'unknown' },
            reactions: [],
            replyTo,
          };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { text?: string; editedAt?: Date };
        }) => {
          const m = messages.get(where.id);
          if (!m) throw new Error('Message not found');
          if (data.text !== undefined) m.text = data.text;
          if (data.editedAt !== undefined) m.editedAt = data.editedAt;
          const sender = users.get(m.senderId);
          return {
            ...m,
            sender: sender
              ? { id: sender.id, name: sender.name }
              : { id: m.senderId, name: 'unknown' },
            reactions: [],
            replyTo: null,
          };
        },
      ),
    },
    mention: {
      createMany: jest.fn(async () => ({ count: 0 })),
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
    process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;

    users.set('user-A', { id: 'user-A', name: 'Alice', email: 'a@example.com' });
    users.set('user-B', { id: 'user-B', name: 'Bob', email: 'b@example.com' });

    // A is a member of two rooms (R1 and R2) so we can craft a cross-room
    // reply attempt where the sender is legitimately a member of both.
    roomMembers.push(
      { userId: 'user-A', roomId: 'room-R1', role: 'member' },
      { userId: 'user-A', roomId: 'room-R2', role: 'member' },
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

    // Seed the ConfigService with R2_PUBLIC_URL so the whitelist is
    // deterministic regardless of host env. Other lookups (JWT_SECRET etc)
    // fall through to process.env via the real ConfigService.
    const realConfig = moduleFixture.get(ConfigService);
    const origGetOrThrow = realConfig.getOrThrow.bind(realConfig);
    jest
      .spyOn(realConfig, 'getOrThrow')
      .mockImplementation((key: string) =>
        key === 'R2_PUBLIC_URL' ? R2_PUBLIC_URL : origGetOrThrow(key),
      );

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    const jwt = app.get(JwtService);
    tokenA = await jwt.signAsync(
      { sub: 'user-A', email: 'a@example.com' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    users.clear();
    roomMembers.length = 0;
    messages.clear();
    if (app) await app.close();
  });

  // ── Text length ──────────────────────────────────────────────────────────

  it('rejects text longer than 4000 chars on create', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'x'.repeat(4001) })
      .expect(400);
  });

  it('accepts text exactly 4000 chars on create', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'x'.repeat(4000) })
      .expect(201);
  });

  it('accepts empty text on create (attachment-only flow)', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: '' })
      .expect(201);
  });

  it('rejects edit text longer than 4000 chars', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'original' })
      .expect(201);
    const id = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/api/messages/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'x'.repeat(4001) })
      .expect(400);
  });

  // ── Attachment URL whitelist ─────────────────────────────────────────────

  it('rejects attachment.url not from R2_PUBLIC_URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        text: '',
        attachment: {
          name: 'foo.png',
          type: 'image',
          size: '12 KB',
          url: 'https://attacker.example/foo.png',
        },
      })
      .expect(400);
    expect(res.body.message).toBe('Attachment URL is not from an allowed source');
  });

  it('accepts attachment.url under R2_PUBLIC_URL', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        text: '',
        attachment: {
          name: 'foo.png',
          type: 'image',
          size: '12 KB',
          url: `${R2_PUBLIC_URL}/abc.png`,
        },
      })
      .expect(201);
  });

  it('rejects unknown attachment.type via the validation pipe', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        text: '',
        attachment: {
          name: 'foo.exe',
          type: 'executable',
          size: '12 KB',
          url: `${R2_PUBLIC_URL}/abc.exe`,
        },
      })
      .expect(400);
  });

  it('strips unknown keys on attachment via global whitelist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        text: '',
        attachment: {
          name: 'foo.png',
          type: 'image',
          size: '12 KB',
          url: `${R2_PUBLIC_URL}/abc.png`,
          evil: 'pwn',
        },
      })
      .expect(201);

    const id = res.body.id;
    const stored = messages.get(id);
    expect(stored?.attachment).toBeDefined();
    expect((stored!.attachment as Record<string, unknown>).evil).toBeUndefined();
    expect((stored!.attachment as Record<string, unknown>).name).toBe('foo.png');
  });

  // ── Cross-room reply check ───────────────────────────────────────────────

  it('rejects replyToId pointing at a message in a different room', async () => {
    // Seed a message in R2 directly.
    messages.set('parent-r2', {
      id: 'parent-r2',
      roomId: 'room-R2',
      senderId: 'user-A',
      text: 'private R2 content',
      createdAt: new Date(),
      editedAt: null,
      isDeleted: false,
      replyToId: null,
      attachment: null,
      forwarded: null,
    });

    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'reply across rooms', replyToId: 'parent-r2' })
      .expect(400);
    expect(res.body.message).toBe('Cannot reply to a message from another room');

    // Confirm no row was written
    const wrote = [...messages.values()].some(
      (m) => m.replyToId === 'parent-r2',
    );
    expect(wrote).toBe(false);
  });

  it('accepts replyToId pointing at a same-room message', async () => {
    const parentRes = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'parent in R1' })
      .expect(201);
    const parentId = parentRes.body.id;

    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'reply in R1', replyToId: parentId })
      .expect(201);

    expect(res.body.replyToId).toBe(parentId);
    expect(res.body.replyTo).toBeDefined();
    expect(res.body.replyTo.id).toBe(parentId);
  });

  it('rejects replyToId pointing at a non-existent message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/rooms/room-R1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'orphan reply', replyToId: 'does-not-exist' })
      .expect(404);
    expect(res.body.message).toBe('Reply target not found');
  });
});
