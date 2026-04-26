import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  private get from(): string {
    return this.config.get('SMTP_FROM', 'noreply@pulsechat.app');
  }

  private get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', 'http://localhost:3000');
  }

  private isSmtpConfigured(): boolean {
    return Boolean(this.config.get('SMTP_HOST') && this.config.get('SMTP_USER'));
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (!this.isSmtpConfigured()) {
      this.logger.warn(`SMTP not configured — skipping password reset email to ${to}`);
      return;
    }

    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your password',
        html: `
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
      throw error;
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    if (!this.isSmtpConfigured()) {
      this.logger.warn(`SMTP not configured — skipping verification email to ${to}`);
      return;
    }

    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Verify your email address',
        html: `
          <h2>Email Verification</h2>
          <p>Welcome! Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>This link expires in 24 hours.</p>
        `,
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error);
      throw error;
    }
  }
}
