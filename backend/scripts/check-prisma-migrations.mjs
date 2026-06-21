import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = process.env.PRISMA_MIGRATIONS_DIR
  ? path.resolve(process.env.PRISMA_MIGRATIONS_DIR)
  : path.resolve(scriptDir, '..', 'prisma', 'migrations');

function safeFolderName(name) {
  return path.basename(name).replace(/[^A-Za-z0-9_.-]/g, '_');
}

console.log('[prisma] checking migration directories...');

if (!existsSync(migrationsDir)) {
  console.error('[prisma] ERROR: migrations directory not found');
  process.exit(1);
}

const migrationDirectories = readdirSync(migrationsDir)
  .filter((entryName) => {
    const entryPath = path.join(migrationsDir, entryName);
    return statSync(entryPath).isDirectory();
  })
  .sort((left, right) => left.localeCompare(right));

console.log(`[prisma] migration directories found: ${migrationDirectories.length}`);

const missingMigrationSql = migrationDirectories.filter((entryName) => {
  const migrationSqlPath = path.join(migrationsDir, entryName, 'migration.sql');
  return !existsSync(migrationSqlPath) || !statSync(migrationSqlPath).isFile();
});

if (missingMigrationSql.length > 0) {
  const safeNames = missingMigrationSql.map(safeFolderName);

  console.error(`[prisma] missing migration.sql: ${safeNames.join(', ')}`);

  for (const folderName of safeNames) {
    console.error(
      `[prisma] ERROR: migration directory missing migration.sql: ${folderName}`,
    );
  }

  process.exit(1);
}
