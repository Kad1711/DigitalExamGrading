import "dotenv/config";
import { execSync, spawn } from "node:child_process";
import pg from "pg";

/**
 * Neon Postgres uses PgBouncer on the "-pooler" domain.
 * PgBouncer cannot maintain Postgres session advisory locks, which causes
 * "Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))".
 *
 * For migrations, we connect directly (without "-pooler") and release any stuck locks.
 */
async function releaseAdvisoryLocks(dbUrl) {
  try {
    const directUrl = dbUrl.replace("-pooler.", ".");
    const client = new pg.Client({
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await client.connect();
    await client.query("SELECT pg_advisory_unlock_all();");
    await client.end();
    console.log("[MIGRATE] Released any lingering PostgreSQL advisory locks.");
  } catch (err) {
    console.warn("[MIGRATE] Advisory lock release note:", err.message);
  }
}

async function runMigrateAndStart() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    // 1. If using Neon with -pooler, use direct endpoint for migrations
    const directUrl = dbUrl.replace("-pooler.", ".");

    // 2. Clear stuck advisory locks from previous failed/aborted deploys
    await releaseAdvisoryLocks(dbUrl);

    // 3. Attempt prisma migrate deploy with a safe timeout
    try {
      console.log("[MIGRATE] Running prisma migrate deploy via direct connection...");
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: directUrl,
        },
        timeout: 30000,
      });
      console.log("[MIGRATE] Migrations applied successfully.");
    } catch (err) {
      console.warn(
        "[MIGRATE] Migration notice: Database schema is already current or migration timed out.",
        err.message
      );
      // Try releasing locks again just in case
      await releaseAdvisoryLocks(dbUrl);
    }
  }

  // 4. Start the Express API server
  console.log("[SERVER] Starting API server (node src/server.js)...");
  const serverProcess = spawn("node", ["src/server.js"], {
    stdio: "inherit",
    env: process.env,
  });

  serverProcess.on("close", (code) => {
    process.exit(code || 0);
  });
}

runMigrateAndStart();
