import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest: null });
    } else {
      this.client = new Redis({
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      });
    }
  }

  /** Store a key with a TTL in seconds. */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /** Get a value by key (null if expired / missing). */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Delete a key. */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Atomic increment; returns the new value. Used by rate-limit counters. */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /** Set a TTL (seconds) on an existing key. */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
