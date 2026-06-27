import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('REDIS_URL is not configured.');
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    this.client.on('error', () => {
      this.logger.warn('Redis client connection error.');
    });
  }

  async onModuleInit() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.connect();
      this.logger.log('Redis connection established.');
    } catch {
      this.logger.warn('Redis connection was not established at startup.');
    }
  }

  async onModuleDestroy() {
    if (this.client?.status === 'ready') {
      await this.client.quit();
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    if (this.client.status !== 'ready') {
      await this.client.connect();
    }

    return (await this.client.ping()) === 'PONG';
  }

  async incrementAiDailyQuota(
    key: string,
    limit: number,
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.getReadyClient();
    const result = await client.eval(
      `local current = redis.call('GET', KEYS[1])
       if current and tonumber(current) >= tonumber(ARGV[1]) then
         return 0
       end
       local next = redis.call('INCR', KEYS[1])
       if next == 1 or redis.call('TTL', KEYS[1]) < 0 then
         redis.call('EXPIRE', KEYS[1], ARGV[2])
       end
       return 1`,
      1,
      key,
      limit,
      ttlSeconds,
    );

    return result === 1;
  }

  async acquireAiConcurrencyLock(
    key: string,
    token: string,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    const client = this.getReadyClient();
    const result = await client.set(
      key,
      token,
      'PX',
      ttlMilliseconds,
      'NX',
    );

    return result === 'OK';
  }

  async releaseAiConcurrencyLock(
    key: string,
    token: string,
  ): Promise<void> {
    const client = this.getReadyClient();

    await client.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
         return redis.call('DEL', KEYS[1])
       end
       return 0`,
      1,
      key,
      token,
    );
  }

  private getReadyClient(): Redis {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Redis is unavailable.');
    }

    return this.client;
  }
}
