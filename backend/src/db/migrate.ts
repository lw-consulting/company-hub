import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  // Resolve migrations folder relative to this file's location
  const migrationsFolder = path.resolve(__dirname, 'migrations');

  console.log('Running migrations from:', migrationsFolder);
  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed.');
  } catch (err: any) {
    // If no migrations exist yet, just log and continue
    if (err.message?.includes('No migration') || err.code === 'ENOENT') {
      console.log('No migrations found, skipping. Use db:generate to create migrations.');
    } else {
      throw err;
    }
  }

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
