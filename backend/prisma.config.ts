import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../.env' });
config({ path: '.env' });

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
