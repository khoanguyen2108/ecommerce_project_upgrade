# Belikeme Clothing Store MVP

Belikeme is a fullstack e-commerce MVP for a clothing store. This checkout
contains the NestJS backend API, Prisma migrations, Docker Compose services for
PostgreSQL and Redis, and a placeholder `front/` folder.

The recommended local setup is Docker-first for the backend stack:

- Backend API runs in Docker.
- PostgreSQL runs in Docker.
- Redis runs in Docker.
- Prisma migrations run automatically when the backend container starts.
- Frontend stays separate and runs with npm from `front/` when a frontend
  package exists.

## Tech Stack

- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis, JWT, Nodemailer.
- Database: PostgreSQL with Prisma migrations.
- Cache: Redis through `ioredis`.
- Local services: Docker Compose.
- Frontend: expected under `front/`, but this checkout does not currently
  include `front/package.json`.

## Prerequisites

Install these before starting:

- Git.
- Docker Desktop.
- Node.js and npm, needed only for direct backend work or the future frontend.
- Optional: Postman or Insomnia for API testing.

## Docker-First Local Setup

From the repo root:

```bash
cp .env.example .env
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
```

On Windows PowerShell, copying the env file can be done with:

```powershell
Copy-Item .env.example .env
```

The backend API is available at:

```text
http://localhost:3001
```

Swagger/OpenAPI documentation is available locally at:

```text
http://localhost:3001/api-docs
```

The OpenAPI JSON spec is available at:

```text
http://localhost:3001/api-docs-json
```

The OpenAPI YAML spec is also available at:

```text
http://localhost:3001/api-docs-yaml
```

To call protected APIs from Swagger UI:

1. Login through `POST /auth/login`.
2. Copy the returned `accessToken`.
3. Click `Authorize`.
4. Paste the token value only. Swagger sends it as `Bearer <accessToken>`.

Admin catalog APIs require an authenticated user with the `ADMIN` role.
Swagger is enabled by default for local development. In production, set
`SWAGGER_ENABLED=true` explicitly to expose the docs.

Host tools can connect to the local services at:

| Service | Host URL | Container URL |
| --- | --- | --- |
| Backend API | `http://localhost:3001` | `http://backend:3000` |
| PostgreSQL | `localhost:5435` | `postgres:5432` |
| Redis | `localhost:6380` | `redis:6379` |

The backend container uses Docker service names internally:

```env
PORT=3000
DATABASE_URL=postgresql://belikeme:belikeme_password@postgres:5432/belikeme?schema=public
REDIS_URL=redis://redis:6379
```

Do not use `localhost:5435` or `localhost:6380` from inside the backend
container. Those host ports are for tools running on your machine.

## Prisma Migrations

Docker image build does not run database migrations and does not require a live
database.

When the backend container starts, `backend/docker-entrypoint.sh` waits briefly
for PostgreSQL, then runs:

```bash
npx prisma migrate deploy
```

After existing migrations are applied, it starts the NestJS API with:

```bash
npm run start:prod
```

Use `migrate deploy` for the Docker startup flow because it applies committed
migrations without creating new migration files or resetting data.

## Health Checks

After `docker compose up -d`, test the backend:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/db
curl http://localhost:3001/health/redis
```

In PowerShell, use `curl.exe` if `curl` is aliased:

```powershell
curl.exe http://localhost:3001/health
curl.exe http://localhost:3001/health/db
curl.exe http://localhost:3001/health/redis
```

## Useful Docker Commands

```bash
docker compose logs -f backend
docker compose exec backend sh
docker compose exec postgres psql -U belikeme -d belikeme
docker compose down
docker compose down -v
```

`docker compose down -v` deletes the local PostgreSQL and Redis volumes,
including local database data. Do not run destructive commands on production
databases.

If the optional seed script is needed:

```bash
docker compose exec backend npm run prisma:seed
```

## Environment Modes

Use `.env.example` as a safe template only. Do not commit real `.env` files or
real secrets.

For the Docker backend, use service names:

```env
DATABASE_URL=postgresql://belikeme:belikeme_password@postgres:5432/belikeme?schema=public
REDIS_URL=redis://redis:6379
```

If you intentionally run the backend on your host with npm while PostgreSQL and
Redis stay in Docker, switch those values to host ports:

```env
PORT=3001
DATABASE_URL=postgresql://belikeme:belikeme_password@localhost:5435/belikeme?schema=public
REDIS_URL=redis://localhost:6380
```

The future frontend URL is:

```env
CORS_ORIGIN=http://localhost:5174
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:5174
```

## Frontend Setup

Keep frontend development outside Docker.

This checkout currently has a `front/` folder but no `front/package.json`, so
there is no frontend install or dev command to run yet. When the frontend
package is added, the expected flow is:

```bash
cd front
npm install
npm run dev
```

Only put browser-safe values in `NEXT_PUBLIC_*` variables. Do not put backend
secrets in frontend environment variables.

## Backend Development Without Docker

For direct backend development on the host:

```bash
docker compose up -d postgres redis
cd backend
npm install
npm run prisma:validate
npm run prisma:generate
npx prisma migrate dev
npm run start:dev
```

Use this mode when you specifically want NestJS watch mode. The recommended
teammate setup remains `docker compose up -d`.

## Git and Ignored Files

Ignored local files include `.env`, `.env.*`, `node_modules`, `dist`,
`backend/node_modules`, `backend/dist`, `backend/*.tsbuildinfo`,
`backend/src/generated/prisma`, and `doc/`.

Do not commit secrets, generated dependency folders, generated Prisma client
output, build output, or private local planning notes.
