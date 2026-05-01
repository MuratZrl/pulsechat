import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

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
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
      ...tokens,
    };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(
        refreshToken,
        { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, emailVerified: true },
      });
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ── Get Me ──────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, bio: true,
        avatarUrl: true, emailVerified: true, createdAt: true,
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

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
