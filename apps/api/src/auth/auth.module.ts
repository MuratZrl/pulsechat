import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secrets provided per-call via ConfigService
    UploadModule, // R2Service — account deletion removes the user's uploads
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
