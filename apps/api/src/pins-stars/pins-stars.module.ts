import { Module } from '@nestjs/common';
import { PinsStarsService } from './pins-stars.service';
import { PinsStarsController } from './pins-stars.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PinsStarsService],
  controllers: [PinsStarsController],
})
export class PinsStarsModule {}
