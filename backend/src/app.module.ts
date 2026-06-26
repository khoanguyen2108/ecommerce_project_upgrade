import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminPaymentsModule } from './admin-payments/admin-payments.module';
import { AdminOrdersModule } from './admin-orders/admin-orders.module';
import { AdminStatsModule } from './admin-stats/admin-stats.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminVouchersModule } from './admin-vouchers/admin-vouchers.module';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { ChatModule } from './chat/chat.module';
import { CatalogModule } from './catalog/catalog.module';
import { CheckoutModule } from './checkout/checkout.module';
import { HealthModule } from './health/health.module';
import { LandingGalleryModule } from './landing-gallery/landing-gallery.module';
import { LandingPageModule } from './landing-page/landing-page.module';
import { OrderExpiryModule } from './order-expiry/order-expiry.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

const secondsToMilliseconds = (seconds: number) => seconds * 1000;

const getPositiveNumber = (
  configService: ConfigService,
  key: string,
  defaultValue: number,
) => {
  const value = Number(configService.get<string | number>(key) ?? defaultValue);

  return Number.isFinite(value) && value > 0 ? value : defaultValue;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: secondsToMilliseconds(
            getPositiveNumber(configService, 'RATE_LIMIT_TTL', 60),
          ),
          limit: getPositiveNumber(configService, 'RATE_LIMIT_MAX', 100),
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    AddressesModule,
    AdminOrdersModule,
    AdminPaymentsModule,
    AdminUsersModule,
    AdminVouchersModule,
    AdminStatsModule,
    CatalogModule,
    LandingGalleryModule,
    LandingPageModule,
    CartModule,
    ChatModule,
    CheckoutModule,
    OrderExpiryModule,
    OrdersModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
