import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-random-token'),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  let redis: RedisService;
  let email: EmailService;

  const mockUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: 'hashed-password',
    emailVerified: false,
    bio: null,
    avatarUrl: null,
    createdAt: new Date('2025-01-01'),
  };

  const mockPrisma = {
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
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    mention: {},
  };

  const mockJwt = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const configValues: Record<string, string> = {
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  const mockConfig = {
    get: jest.fn((key: string) => configValues[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = configValues[key];
      if (value === undefined) {
        throw new Error(`Configuration key "${key}" does not exist`);
      }
      return value;
    }),
  };

  const mockRedis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockEmail = {
    sendPasswordResetEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    mockJwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'john@example.com' });

    // Sensible defaults for the new RefreshToken model so individual tests
    // only have to override what they actually exercise.
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.refreshToken.findMany.mockResolvedValue([]);
    mockPrisma.refreshToken.delete.mockResolvedValue({});
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
    config = module.get<ConfigService>(ConfigService);
    redis = module.get<RedisService>(RedisService);
    email = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Register ──────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('should register a new user and return user with tokens', async () => {
      const createdUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'room-1', name: 'General' },
        { id: 'room-2', name: 'Random' },
      ]);
      mockPrisma.roomMember.upsert.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: createdUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: registerDto.name,
          email: registerDto.email,
          passwordHash: 'hashed-password',
        },
        select: { id: true, name: true, email: true, emailVerified: true },
      });
      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { name: { in: ['General', 'Random'] } },
      });
      expect(mockPrisma.roomMember.upsert).toHaveBeenCalledTimes(2);
      expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
      // Refresh token must be persisted server-side so it can be revoked.
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: 'hashed-password',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should throw ConflictException with a generic message if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Registration could not be completed',
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('should login successfully and return user with tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          emailVerified: mockUser.emailVerified,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should still call bcrypt.compare when email does not exist (timing equalization)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      // bcrypt.compare runs against a dummy hash so timing does not reveal
      // whether the email exists. Two reject assertions => two login calls.
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        expect.stringMatching(/^\$2[ab]\$/),
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  // ── Refresh Tokens ────────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should return new tokens for a valid refresh token and rotate the stored row', async () => {
      const storedToken = {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'john@example.com' });
      mockPrisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
      });

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-jwt-refresh-secret',
      });
      // Old row must be deleted (rotation), new row inserted.
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      // No reuse → no scorched-earth deleteMany.
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for an invalid refresh token signature', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled();
    });

    it('should revoke all of a user\'s tokens when a valid-signature token has no DB row (reuse)', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'john@example.com' });
      // Signature valid but no stored row matches — reuse path.
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);

      await expect(service.refreshTokens('replayed-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user no longer exists', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'deleted-user', email: 'gone@example.com' });
      const storedToken = {
        id: 'rt-1',
        userId: 'deleted-user',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      mockPrisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should delete every refresh token for the user', async () => {
      const result = await service.logout('user-1');
      expect(result).toEqual({ message: 'Logged out' });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ── Get Me ────────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('should return the user profile', async () => {
      const userProfile = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        bio: null,
        avatarUrl: null,
        emailVerified: false,
        createdAt: new Date('2025-01-01'),
      };
      mockPrisma.user.findUnique.mockResolvedValue(userProfile);

      const result = await service.getMe('user-1');

      expect(result).toEqual(userProfile);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          name: true,
          email: true,
          bio: true,
          avatarUrl: true,
          emailVerified: true,
          createdAt: true,
        },
      });
    });
  });

  // ── Change Password ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword1!',
    };

    it('should change the password and revoke all refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.changePassword('user-1', changePasswordDto);

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.passwordHash,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should throw BadRequestException for wrong current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow('Current password is incorrect');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── Forgot Password ───────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should send a reset email when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockRedis.set.mockResolvedValue('OK');
      mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('john@example.com');

      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'reset:mock-random-token',
        mockUser.id,
        3600,
      );
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'john@example.com',
        'mock-random-token',
      );
    });

    it('should return success even when user does not exist (prevents enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockEmail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ── Reset Password ────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const resetPasswordDto = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword1!',
    };

    it('should reset the password and revoke refresh tokens', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(1);

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toEqual({ message: 'Password has been reset successfully' });
      expect(mockRedis.get).toHaveBeenCalledWith('reset:valid-reset-token');
      expect(bcrypt.hash).toHaveBeenCalledWith(resetPasswordDto.newPassword, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('reset:valid-reset-token');
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should throw BadRequestException for invalid or expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Invalid or expired reset token',
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── Verify Email ──────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify the email successfully', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      mockPrisma.user.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(1);

      const result = await service.verifyEmail('valid-verify-token');

      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(mockRedis.get).toHaveBeenCalledWith('verify:valid-verify-token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('verify:valid-verify-token');
    });

    it('should throw BadRequestException for invalid or expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        'Invalid or expired verification token',
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── Resend Verification ───────────────────────────────────────────────────────

  describe('resendVerification', () => {
    it('should resend the verification email', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      mockPrisma.user.findUnique.mockResolvedValue(unverifiedUser);
      mockRedis.set.mockResolvedValue('OK');
      mockEmail.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.resendVerification('user-1');

      expect(result).toEqual({ message: 'Verification email sent' });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'verify:mock-random-token',
        'user-1',
        86400,
      );
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalledWith(
        unverifiedUser.email,
        'mock-random-token',
      );
    });

    it('should throw BadRequestException if email is already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);

      await expect(service.resendVerification('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendVerification('user-1')).rejects.toThrow(
        'Email is already verified',
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  // ── Delete Account ────────────────────────────────────────────────────────────

  describe('deleteAccount', () => {
    it('should delete the account and revoke refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.message.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.deleteAccount('user-1', 'Password1!');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password1!',
        mockUser.passwordHash,
      );
      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: { senderId: 'user-1' },
        data: { isDeleted: true, text: '' },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw BadRequestException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.deleteAccount('user-1', 'WrongPassword1!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deleteAccount('user-1', 'WrongPassword1!'),
      ).rejects.toThrow('Incorrect password');
      expect(mockPrisma.message.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });
});
