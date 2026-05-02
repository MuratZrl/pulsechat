import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRawUnsafe('SELECT 1');
          return { database: { status: 'up' } };
        } catch {
          return { database: { status: 'down' } };
        }
      },
      async (): Promise<HealthIndicatorResult> => {
        // Read-only PING — the previous SET wrote a key with a 10s TTL on
        // every hit, which churned Redis under any load balancer that
        // pings frequently.
        try {
          const result = await this.redis.ping();
          if (result !== 'PONG') throw new Error('unexpected response');
          return { redis: { status: 'up' } };
        } catch {
          return { redis: { status: 'down' } };
        }
      },
    ]);
  }
}
