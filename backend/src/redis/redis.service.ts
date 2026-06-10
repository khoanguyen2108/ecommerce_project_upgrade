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
}
