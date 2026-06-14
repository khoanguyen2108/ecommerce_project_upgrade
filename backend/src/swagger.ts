import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH_NAME } from './common/swagger/api-docs.constants';

const isSwaggerEnabled = () => {
  const configuredValue = process.env.SWAGGER_ENABLED?.trim().toLowerCase();

  if (process.env.NODE_ENV === 'production') {
    return configuredValue === 'true';
  }

  return configuredValue !== 'false';
};

export const setupSwagger = (app: INestApplication) => {
  if (!isSwaggerEnabled()) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Belikeme Clothing Store API')
    .setDescription('Backend API documentation for the clothing e-commerce MVP')
    .setVersion('0.1.0')
    .addTag('health')
    .addTag('auth')
    .addTag('categories')
    .addTag('products')
    .addTag('admin-users')
    .addTag('admin-stats')
    .addTag('admin-categories')
    .addTag('admin-products')
    .addTag('product-variants')
    .addTag('orders')
    .addTag('payments')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the JWT access token only. Swagger sends it as Authorization: Bearer <token>.',
      },
      SWAGGER_BEARER_AUTH_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Belikeme Clothing Store API Docs',
    jsonDocumentUrl: 'api-docs-json',
    raw: ['json', 'yaml'],
    swaggerOptions: {
      persistAuthorization: true,
    },
    yamlDocumentUrl: 'api-docs-yaml',
  });
};
