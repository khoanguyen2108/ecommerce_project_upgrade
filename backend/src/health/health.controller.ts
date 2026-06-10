import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  dependencyHealthDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
  healthDataExample,
} from '../common/swagger/api-examples';
import { HealthService } from './health.service';

@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: 'Check backend health' })
  @ApiOkResponse(
    envelopeResponse('Backend API is reachable.', healthDataExample),
  )
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'belikeme-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({ summary: 'Check database health' })
  @ApiOkResponse(
    envelopeResponse('Database connection is healthy.', dependencyHealthDataExample),
  )
  @ApiServiceUnavailableResponse(
    errorEnvelopeResponse(
      'Database is unavailable.',
      'DATABASE_UNAVAILABLE',
      'Database is unavailable.',
    ),
  )
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

  @ApiOperation({ summary: 'Check Redis health' })
  @ApiOkResponse(
    envelopeResponse('Redis connection is healthy.', dependencyHealthDataExample),
  )
  @ApiServiceUnavailableResponse(
    errorEnvelopeResponse(
      'Redis is unavailable.',
      'REDIS_UNAVAILABLE',
      'Redis is unavailable.',
    ),
  )
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
