import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const FALLBACK_DATABASE_URL =
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly hasDatabaseUrl: boolean;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    super({
      adapter: new PrismaPg({
        connectionString: databaseUrl ?? FALLBACK_DATABASE_URL,
      }),
    });

    this.hasDatabaseUrl = Boolean(databaseUrl);
  }

  async onModuleInit() {
    if (!this.hasDatabaseUrl) {
      this.logger.warn('DATABASE_URL is not configured.');
      return;
    }

    try {
      await this.$connect();
      this.logger.log('PostgreSQL connection established.');
    } catch {
      this.logger.warn('PostgreSQL connection was not established at startup.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  isConfigured(): boolean {
    return this.hasDatabaseUrl;
  }
}
