import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { EmailService } from './../src/email/email.service';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    onModuleInit: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    room: {
      findMany: jest.fn(),
    },
    roomMember: {
      upsert: jest.fn(),
    },
    message: {
      updateMany: jest.fn(),
    },
  };

  const mockRedis = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn(),
  };

  const mockEmail = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    // Set required env vars for JwtStrategy and ConfigService
    process.env.JWT_SECRET = 'test-jwt-secret-for-e2e';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-e2e';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Health ─────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('should return 200 with health check result', () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.set.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  // ── Register ───────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const fakeUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
      mockPrisma.user.create.mockResolvedValue(fakeUser);
      mockPrisma.room.findMany.mockResolvedValue([]); // no default rooms
      mockRedis.set.mockResolvedValue(undefined);
      mockEmail.sendVerificationEmail.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'Pass1!' })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should return 400 when validation fails (missing fields)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'bad' })
        .expect(400);
    });

    it('should return 400 when password is too weak', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: 'weak' })
        .expect(400);
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login successfully and return tokens', async () => {
      const passwordHash = await bcrypt.hash('Pass1!', 10);
      const fakeUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        passwordHash,
      };

      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Pass1!' })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('user-1');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'Pass1!' })
        .expect(401);
    });
  });

  // ── Get Me ─────────────────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated', async () => {
      const passwordHash = await bcrypt.hash('Pass1!', 10);
      const fakeUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        passwordHash,
      };

      // First login to get a real token
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Pass1!' });

      const token = loginRes.body.accessToken;

      // Now mock the findUnique for JwtStrategy.validate and getMe
      const meProfile = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        bio: null,
        avatarUrl: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(meProfile);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe('user-1');
      expect(res.body.email).toBe('test@example.com');
    });

    it('should return 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });
  });

  // ── Change Password ────────────────────────────────────────────────────────

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully with valid token', async () => {
      const passwordHash = await bcrypt.hash('Pass1!', 10);
      const fakeUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        passwordHash,
      };

      // Login first to get a token
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Pass1!' });

      const token = loginRes.body.accessToken;

      // Mock for JwtStrategy.validate, then changePassword's findUnique + update
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.update.mockResolvedValue({ ...fakeUser });

      const res = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Pass1!', newPassword: 'NewPass2@' })
        .expect(201);

      expect(res.body.message).toBe('Password changed successfully');
    });
  });
});
