import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.io adapter that bridges broadcasts across API replicas via Redis
 * pub/sub. Without this, `server.to(roomId).emit(...)` only reaches sockets
 * connected to the same Node process — fine on a single instance, broken the
 * moment we scale to two.
 *
 * Pub/sub-mode ioredis clients can't issue regular commands, so this adapter
 * owns its own dedicated pubClient/subClient instead of reusing RedisService.
 */
export class RedisIoAdapter extends IoAdapter {
  private pubClient!: Redis;
  private subClient!: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = process.env.REDIS_URL;
    const opts: RedisOptions = { maxRetriesPerRequest: null };

    this.pubClient = url
      ? new Redis(url, opts)
      : new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          ...opts,
        });
    this.subClient = this.pubClient.duplicate();

    // ioredis auto-connects lazily, but ping early so a misconfigured URL
    // surfaces at boot instead of silently breaking cross-replica delivery.
    await Promise.all([this.pubClient.ping(), this.subClient.ping()]);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: ReturnType<typeof createAdapter>) => void;
    };
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
