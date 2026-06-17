import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PENDING_EXPIRES_MINUTES = 30;
const DEFAULT_SWEEP_INTERVAL_SECONDS = 60;
const ORDER_EXPIRY_BATCH_SIZE = 50;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

export interface OrderExpirySweepResult {
  expiredOrders: number;
  expiredPayments: number;
}

@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryService.name);
  private readonly pendingExpiresMinutes: number;
  private readonly sweepIntervalSeconds: number;
  private isSweepRunning = false;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.pendingExpiresMinutes = this.getPositiveConfigNumber(
      'ORDER_PENDING_EXPIRES_MINUTES',
      DEFAULT_PENDING_EXPIRES_MINUTES,
    );
    this.sweepIntervalSeconds = this.getPositiveConfigNumber(
      'ORDER_EXPIRY_SWEEP_INTERVAL_SECONDS',
      DEFAULT_SWEEP_INTERVAL_SECONDS,
    );
  }

  onModuleInit() {
    if (!this.prismaService.isConfigured()) {
      this.logger.warn(
        'Order expiry worker is disabled because DATABASE_URL is not configured.',
      );
      return;
    }

    this.sweepTimer = setInterval(
      () => void this.runScheduledSweep(),
      this.sweepIntervalSeconds * MILLISECONDS_PER_SECOND,
    );
    this.sweepTimer.unref?.();
    void this.runScheduledSweep();
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
  }

  getPendingOrderExpiresAt(from = new Date()): Date {
    return new Date(
      from.getTime() +
        this.pendingExpiresMinutes *
          SECONDS_PER_MINUTE *
          MILLISECONDS_PER_SECOND,
    );
  }

  async sweepOverdueOrders(now = new Date()): Promise<OrderExpirySweepResult> {
    if (this.isSweepRunning) {
      return {
        expiredOrders: 0,
        expiredPayments: 0,
      };
    }

    this.isSweepRunning = true;

    try {
      return await this.expireOverdueOrders(now);
    } finally {
      this.isSweepRunning = false;
    }
  }

  private async runScheduledSweep() {
    try {
      const result = await this.sweepOverdueOrders();

      if (result.expiredOrders > 0 || result.expiredPayments > 0) {
        this.logger.log(
          JSON.stringify({
            code: 'ORDER_EXPIRED_BY_WORKER',
            expiredOrders: result.expiredOrders,
            expiredPayments: result.expiredPayments,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          code: 'ORDER_EXPIRY_SWEEP_FAILED',
          error: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    }
  }

  private async expireOverdueOrders(
    now: Date,
  ): Promise<OrderExpirySweepResult> {
    let expiredOrders = 0;
    let expiredPayments = 0;

    while (true) {
      const candidates = await this.prismaService.order.findMany({
        where: {
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt: {
            lte: now,
          },
        },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: ORDER_EXPIRY_BATCH_SIZE,
        select: {
          id: true,
        },
      });

      if (candidates.length === 0) {
        break;
      }

      const batchResult = await this.prismaService.$transaction(async (tx) => {
        let batchExpiredOrders = 0;
        let batchExpiredPayments = 0;

        for (const candidate of candidates) {
          const orderUpdate = await tx.order.updateMany({
            where: {
              id: candidate.id,
              status: OrderStatus.PENDING_PAYMENT,
              expiresAt: {
                lte: now,
              },
            },
            data: {
              status: OrderStatus.EXPIRED,
            },
          });

          if (orderUpdate.count !== 1) {
            continue;
          }

          const paymentUpdate = await tx.payment.updateMany({
            where: {
              orderId: candidate.id,
              status: PaymentStatus.PENDING,
            },
            data: {
              status: PaymentStatus.EXPIRED,
              failureReason: 'ORDER_EXPIRED_BY_WORKER',
              cancelledAt: now,
            },
          });

          batchExpiredOrders += 1;
          batchExpiredPayments += paymentUpdate.count;
        }

        return {
          expiredOrders: batchExpiredOrders,
          expiredPayments: batchExpiredPayments,
        };
      });

      expiredOrders += batchResult.expiredOrders;
      expiredPayments += batchResult.expiredPayments;

      if (candidates.length < ORDER_EXPIRY_BATCH_SIZE) {
        break;
      }
    }

    return {
      expiredOrders,
      expiredPayments,
    };
  }

  private getPositiveConfigNumber(key: string, defaultValue: number): number {
    const value = Number(
      this.configService.get<string | number>(key) ?? defaultValue,
    );

    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }
}
