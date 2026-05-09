import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

const R2_PUBLIC_URL = 'https://test-r2.example';

describe('Users updateProfile validation (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;

  // ── In-memory stores ─────────────────────────────────────────────────────
  type StoredUser = {
    id: string;
    name: string;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    avatarPreset: string | null;
    createdAt: Date;
  };

  const users = new Map<string, StoredUser>();
  // Names that should trigger a P2002 on update (case-insensitive match).
  const collisionNames = new Set<string>(['bob']);

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
            if (select.bio) out.bio = u.bio;
            if (select.avatarUrl) out.avatarUrl = u.avatarUrl;
            if (select.avatarPreset) out.avatarPreset = u.avatarPreset;
            if (select.createdAt) out.createdAt = u.createdAt;
            return out;
          }
          return u;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            name?: string;
            bio?: string;
            avatarUrl?: string | null;
            avatarPreset?: string | null;
          };
        }) => {
          const u = users.get(where.id);
          if (!u) {
            throw new Prisma.PrismaClientKnownRequestError('Record not found', {
              code: 'P2025',
              clientVersion: 'test',
            });
          }
          if (
            typeof data.name === 'string' &&
            collisionNames.has(data.name.toLowerCase()) &&
            data.name.toLowerCase() !== u.name.toLowerCase()
          ) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on user_name_lower_idx',
              { code: 'P2002', clientVersion: 'test' },
            );
          }
          if (data.name !== undefined) u.name = data.name;
          if (data.bio !== undefined) u.bio = data.bio;
          if (data.avatarUrl !== undefined) u.avatarUrl = data.avatarUrl;
          if (data.avatarPreset !== undefined) u.avatarPreset = data.avatarPreset;
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            bio: u.bio,
            avatarUrl: u.avatarUrl,
            avatarPreset: u.avatarPreset,
            createdAt: u.createdAt,
          };
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
    process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;

    users.set('user-A', {
      id: 'user-A',
      name: 'Alice',
      email: 'a@example.com',
      bio: null,
      avatarUrl: null,
      avatarPreset: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    users.set('user-B', {
      id: 'user-B',
      name: 'Bob',
      email: 'b@example.com',
      bio: null,
      avatarUrl: null,
      avatarPreset: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

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

    // Override R2_PUBLIC_URL deterministically; let other keys fall through.
    const realConfig = moduleFixture.get(ConfigService);
    const orig = realConfig.getOrThrow.bind(realConfig);
    jest
      .spyOn(realConfig, 'getOrThrow')
      .mockImplementation((key: string) =>
        key === 'R2_PUBLIC_URL' ? R2_PUBLIC_URL : orig(key),
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
    if (app) await app.close();
  });

  // ── Name regex ───────────────────────────────────────────────────────────

  it('accepts a valid name "Alice2"', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Alice2' })
      .expect(200);
    expect(res.body.name).toBe('Alice2');
  });

  it('rejects emoji in name with the regex message', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: '🔥hacker' })
      .expect(400);
    const messages = Array.isArray(res.body.message)
      ? res.body.message
      : [res.body.message];
    expect(messages).toContain(
      'Name can only contain letters, numbers, spaces, and underscores',
    );
  });

  it('rejects HTML-like characters in name with the regex message', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'valid<script>' })
      .expect(400);
    const messages = Array.isArray(res.body.message)
      ? res.body.message
      : [res.body.message];
    expect(messages).toContain(
      'Name can only contain letters, numbers, spaces, and underscores',
    );
  });

  it('rejects names shorter than 2 chars (existing MinLength)', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A' })
      .expect(400);
  });

  // ── Duplicate handling ───────────────────────────────────────────────────

  it('returns 409 with "Name is already taken" on case-sensitive collision', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bob' })
      .expect(409);
    expect(res.body.message).toBe('Name is already taken');
  });

  it('returns 409 with "Name is already taken" on case-insensitive collision', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'BOB' })
      .expect(409);
    expect(res.body.message).toBe('Name is already taken');
  });

  // ── Avatar URL whitelist ─────────────────────────────────────────────────

  it('rejects avatarUrl from a non-R2 origin with 400', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarUrl: 'https://attacker.example/foo.png' })
      .expect(400);
    expect(res.body.message).toBe('Avatar URL is not from an allowed source');
  });

  it('accepts avatarUrl under R2_PUBLIC_URL', async () => {
    const url = `${R2_PUBLIC_URL}/avatars/abc.png`;
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarUrl: url })
      .expect(200);
    expect(res.body.avatarUrl).toBe(url);
  });

  it('accepts an empty-string avatarUrl as a clear signal', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarUrl: '' })
      .expect(200);
    expect(res.body.avatarUrl).toBe('');
  });

  it('accepts a null avatarUrl as a clear signal', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarUrl: null })
      .expect(200);
    expect(res.body.avatarUrl).toBeNull();
  });

  // ── Avatar preset ────────────────────────────────────────────────────────

  it('accepts a valid avatarPreset and clears avatarUrl when sent together', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarPreset: 'fox', avatarUrl: null })
      .expect(200);
    expect(res.body.avatarPreset).toBe('fox');
    expect(res.body.avatarUrl).toBeNull();
  });

  it('rejects an unknown avatarPreset value', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarPreset: 'lobster' })
      .expect(400);
    const messages = Array.isArray(res.body.message)
      ? res.body.message
      : [res.body.message];
    expect(messages.join(' ')).toContain('avatarPreset');
  });

  it('rejects when both avatarUrl and avatarPreset are set non-null', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        avatarUrl: `${R2_PUBLIC_URL}/avatars/abc.png`,
        avatarPreset: 'cat',
      })
      .expect(400);
    expect(res.body.message).toBe(
      'Cannot set both avatarUrl and avatarPreset — choose one',
    );
  });

  it('accepts a null avatarPreset as a clear signal', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ avatarPreset: null })
      .expect(200);
    expect(res.body.avatarPreset).toBeNull();
  });

  // ── Bio length ───────────────────────────────────────────────────────────

  it('rejects bio longer than 500 chars (existing MaxLength)', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bio: 'x'.repeat(501) })
      .expect(400);
  });
});
