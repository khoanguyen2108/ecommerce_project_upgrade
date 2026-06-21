#!/bin/sh
set -eu

echo "[startup] backend container starting"

node <<'NODE'
const net = require('node:net');

const databaseUrl = process.env.DATABASE_URL;
const attempts = Number(process.env.DATABASE_WAIT_ATTEMPTS || 30);
const delayMs = Number(process.env.DATABASE_WAIT_DELAY_MS || 2000);
const timeoutMs = Number(process.env.DATABASE_WAIT_TIMEOUT_MS || 2000);

if (!databaseUrl) {
  console.error('[startup] DATABASE_URL is not configured.');
  process.exit(1);
}

let target;

try {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  target = {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database,
  };
} catch {
  console.error('[startup] DATABASE_URL is invalid.');
  process.exit(1);
}

console.log(
  `[startup] database target: host=${target.host} port=${target.port} database=${target.database || '(not set)'}`,
);
console.log('[startup] waiting for PostgreSQL...');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: target.host,
      port: target.port,
    });
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

(async () => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await canConnect()) {
      console.log('[startup] PostgreSQL reachable');
      return;
    }

    console.log(
      `[startup] waiting for PostgreSQL at ${target.host}:${target.port} (${attempt}/${attempts})...`,
    );
    await sleep(delayMs);
  }

  console.error(`[startup] PostgreSQL was not reachable at ${target.host}:${target.port}.`);
  process.exit(1);
})();
NODE

node scripts/check-prisma-migrations.mjs

echo "[prisma] running prisma migrate deploy..."
set +e
npx prisma migrate deploy
migrate_exit=$?
set -e

if [ "$migrate_exit" -ne 0 ]; then
  echo "[prisma] migrate deploy failed with exit code $migrate_exit" >&2
  exit "$migrate_exit"
fi

echo "[prisma] migrate deploy succeeded"
echo "[startup] starting NestJS app..."
exec npm run start:prod
