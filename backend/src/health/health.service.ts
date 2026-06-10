import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async isDatabaseHealthy(): Promise<boolean> {
    if (!this.prismaService.isConfigured()) {
      return false;
    }

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async isRedisHealthy(): Promise<boolean> {
    try {
      return await this.redisService.ping();
    } catch {
      return false;
    }
  }
}
