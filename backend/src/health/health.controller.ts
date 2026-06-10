import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'belikeme-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  async getDatabaseHealth() {
    const isHealthy = await this.healthService.isDatabaseHealthy();

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable.',
      });
    }

    return {
      status: 'ok',
    };
  }

  @Get('redis')
  async getRedisHealth() {
    const isHealthy = await this.healthService.isRedisHealthy();

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        code: 'REDIS_UNAVAILABLE',
        message: 'Redis is unavailable.',
      });
    }

    return {
      status: 'ok',
    };
  }
}
