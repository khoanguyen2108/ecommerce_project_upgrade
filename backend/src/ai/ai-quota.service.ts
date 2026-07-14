import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

const DAILY_QUOTA_TTL_SECONDS = 24 * 60 * 60;
const CONCURRENCY_LOCK_TTL_MILLISECONDS = 60 * 1_000;

export type AiQuotaEndpoint =
  | 'style-advice'
  | 'recommend-products'
  | 'support';

const DAILY_LIMITS: Record<AiQuotaEndpoint, number> = {
  'style-advice': 100,
  'recommend-products': 20,
  support: 50,
};

export interface AiQuotaLease {
  lockKey: string;
  lockToken: string;
}

@Injectable()
export class AiQuotaService {
  constructor(private readonly redisService: RedisService) {}

  async acquire(
    endpoint: AiQuotaEndpoint,
    userId: string,
  ): Promise<AiQuotaLease> {
    const userKey = createHash('sha256').update(userId).digest('hex');
    const dailyKey = `ai:quota:v1:${endpoint}:${userKey}`;
    const lockKey = `ai:lock:v1:${endpoint}:${userKey}`;
    const lockToken = randomUUID();
    let lockAcquired = false;

    try {
      lockAcquired = await this.redisService.acquireAiConcurrencyLock(
        lockKey,
        lockToken,
        CONCURRENCY_LOCK_TTL_MILLISECONDS,
      );

      if (!lockAcquired) {
        throw new HttpException(
          {
            code: 'AI_CONCURRENCY_LIMITED',
            message: 'An AI request is already in progress. Please try again shortly.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const quotaAvailable = await this.redisService.incrementAiDailyQuota(
        dailyKey,
        DAILY_LIMITS[endpoint],
        DAILY_QUOTA_TTL_SECONDS,
      );

      if (!quotaAvailable) {
        throw new HttpException(
          {
            code: 'AI_RATE_LIMITED',
            message: 'The daily AI request limit has been reached. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return { lockKey, lockToken };
    } catch (error) {
      if (lockAcquired) {
        await this.release({ lockKey, lockToken });
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException({
        code: 'AI_QUOTA_UNAVAILABLE',
        message: 'AI request capacity is temporarily unavailable. Please try again later.',
      });
    }
  }

  async release(lease: AiQuotaLease): Promise<void> {
    try {
      await this.redisService.releaseAiConcurrencyLock(
        lease.lockKey,
        lease.lockToken,
      );
    } catch {
      // The short Redis TTL remains the final safety net if release is unavailable.
    }
  }
}
