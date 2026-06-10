#!/bin/sh
set -eu

node <<'NODE'
const net = require('node:net');

const databaseUrl = process.env.DATABASE_URL;
const attempts = Number(process.env.DATABASE_WAIT_ATTEMPTS || 30);
const delayMs = Number(process.env.DATABASE_WAIT_DELAY_MS || 2000);
const timeoutMs = Number(process.env.DATABASE_WAIT_TIMEOUT_MS || 2000);

if (!databaseUrl) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

let target;

try {
  const parsed = new URL(databaseUrl);
  target = {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
  };
} catch {
  console.error('DATABASE_URL is invalid.');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection(target);
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
      console.log(`PostgreSQL is reachable at ${target.host}:${target.port}.`);
      return;
    }

    console.log(
      `Waiting for PostgreSQL at ${target.host}:${target.port} (${attempt}/${attempts})...`,
    );
    await sleep(delayMs);
  }

  console.error(`PostgreSQL was not reachable at ${target.host}:${target.port}.`);
  process.exit(1);
})();
NODE

npx prisma migrate deploy
exec npm run start:prod
