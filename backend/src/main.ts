import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

async function bootstrap() {
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim())
      : undefined,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
