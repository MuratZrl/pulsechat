import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Pre-computed bcrypt hash used to equalize timing on login when the email
  // does not exist. Without it, a missing user short-circuits the bcrypt
  // compare and an attacker can enumerate accounts by measuring response time.
  private readonly DUMMY_HASH =
    '$2b$10$aqE9nW9rXJK0Y.cDQBEPZuk5JBXuh5XEEhCcTa0oRV2bWrWg5p83e';

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private email: EmailService,
  ) {}

  // ── Register ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      // Generic message — full anti-enumeration would return a fake success
      // and notify the existing address out-of-band. The 409 status still
      // leaks existence; revisit if/when register goes async.
      throw new ConflictException('Registration could not be completed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let user: { id: string; name: string; email: string; emailVerified: boolean };
    try {
      user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: { id: true, name: true, email: true, emailVerified: true },
      });
    } catch (err) {
      // P2002 = unique constraint. Could be name OR email — generic message
      // so the client can't tell which collided (anti-enumeration).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Registration could not be completed');
      }
      throw err;
    }

    // Auto-join default rooms
    const defaultRooms = await this.prisma.room.findMany({
      where: { name: { in: ['General', 'Random'] } },
    });
    for (const room of defaultRooms) {
      await this.prisma.roomMember.upsert({
        where: { userId_roomId: { userId: user.id, roomId: room.id } },
        create: { userId: user.id, roomId: room.id, role: 'member' },
        update: {},
      });
    }

    // Send verification email (fire-and-forget)
    this.sendVerificationToken(user.id, dto.email).catch((err) =>
      this.logger.error('Failed to send verification email', err),
    );

    const tokens = await this.generateTokens(user.id, user.email);
    return { user, ...tokens };
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always run bcrypt.compare so timing does not reveal whether the email
    // exists. A real user is checked against their own hash; a missing user
    // is checked against a static dummy hash.
    const validPassword = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : await bcrypt.compare(dto.password, this.DUMMY_HASH);

    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
      ...tokens,
    };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = this.jwt.verify<{ sub: string; email: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // SHA-256 over the full JWT, deterministic so we can look up by hash.
    // bcrypt cannot be used here because it silently truncates at 72 bytes,
    // and two distinct JWTs for the same user share their first 72 bytes
    // (header + start of the payload), so bcrypt.compare conflated them.
    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.expiresAt <= new Date()
    ) {
      // Signature valid but no live row matches this user — revoked/replayed
      // token or a forgery. Treat as reuse: nuke every refresh token for the
      // user so an attacker holding a stale token can't race the session.
      await this.prisma.refreshToken.deleteMany({
        where: { userId: payload.sub },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    if (!user) throw new UnauthorizedException();

    const issued = await this.issueTokens(user.id, user.email);
    await this.prisma.$transaction([
      this.prisma.refreshToken.delete({ where: { id: stored.id } }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: issued.refreshTokenHash,
          expiresAt: issued.refreshExpiresAt,
        },
      }),
    ]);

    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.revokeAllRefreshTokens(userId);
    return { message: 'Logged out' };
  }

  // ── Get Me ──────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, bio: true,
        avatarUrl: true, avatarPreset: true,
        emailVerified: true, createdAt: true,
      },
    });
  }

  // ── Change Password ─────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate every existing session — a password change must log out
    // any other device that still holds an old refresh token.
    await this.revokeAllRefreshTokens(userId);

    return { message: 'Password changed successfully' };
  }

  // ── Forgot Password ─────────────────────────────────────────────────────────

  async forgotPassword(emailAddr: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: emailAddr },
    });

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.set(`reset:${token}`, user.id, 3600); // 1 hour TTL

    await this.email.sendPasswordResetEmail(emailAddr, token);

    return { message: 'If that email exists, a reset link has been sent' };
  }

  // ── Reset Password ──────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.redis.get(`reset:${dto.token}`);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(`reset:${dto.token}`);
    await this.revokeAllRefreshTokens(userId);

    return { message: 'Password has been reset successfully' };
  }

  // ── Email Verification ──────────────────────────────────────────────────────

  async verifyEmail(token: string) {
    const userId = await this.redis.get(`verify:${token}`);
    if (!userId) throw new BadRequestException('Invalid or expired verification token');

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    await this.redis.del(`verify:${token}`);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) throw new BadRequestException('Email is already verified');

    await this.sendVerificationToken(user.id, user.email);

    return { message: 'Verification email sent' };
  }

  // ── Delete Account ──────────────────────────────────────────────────────────

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new BadRequestException('Incorrect password');

    // Soft-delete messages (preserve chat history for other users)
    await this.prisma.message.updateMany({
      where: { senderId: userId },
      data: { isDeleted: true, text: '' },
    });

    // Cascade on User would purge refresh tokens too, but explicit is clearer
    // and survives a future change to the FK rule.
    await this.revokeAllRefreshTokens(userId);

    // Delete user (cascades: room members, reactions, mentions, pins, stars, read receipts, invites)
    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'Account deleted successfully' };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async sendVerificationToken(userId: string, emailAddr: string) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.set(`verify:${token}`, userId, 86400); // 24 hours
    await this.email.sendVerificationEmail(emailAddr, token);
  }

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    // Refresh tokens carry a random jti so two issuances within the same
    // second don't collide. Without it jsonwebtoken's second-granular iat
    // makes back-to-back refreshes produce identical JWTs, which defeats the
    // rotate-on-use defense (the "new" stored hash matches the old token).
    const refreshPayload = {
      ...payload,
      jti: crypto.randomBytes(16).toString('hex'),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshExpiresAt = this.computeExpiry(refreshExpiresIn);
    return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(userId: string, email: string) {
    const issued = await this.issueTokens(userId, email);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: issued.refreshTokenHash,
        expiresAt: issued.refreshExpiresAt,
      },
    });
    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  private computeExpiry(durationStr: string): Date {
    const match = durationStr.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid duration: ${durationStr}`);
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + parseInt(num, 10) * multipliers[unit]);
  }

  private async revokeAllRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
