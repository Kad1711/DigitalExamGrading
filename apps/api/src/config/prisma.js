import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Resolves and validates the database connection string based on execution environment.
 * Ensures automated tests NEVER write into development or production databases.
 */
export function getDatabaseUrl() {
  const isTest = process.env.NODE_ENV === "test";
  const devUrl = process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL;

  if (isTest) {
    if (!testUrl || !testUrl.trim()) {
      throw new Error(
        "TEST_DATABASE_URL is required when NODE_ENV=test. Refusing to run tests against development database."
      );
    }

    const trimmedTest = testUrl.trim();
    if (devUrl && trimmedTest === devUrl.trim()) {
      throw new Error(
        "TEST_DATABASE_URL matches DATABASE_URL. Refusing to run tests against the development database."
      );
    }

    try {
      const parsed = new URL(trimmedTest);
      const dbName = parsed.pathname.replace(/^\//, "").split("?")[0].toLowerCase();
      if (!dbName.includes("test")) {
        throw new Error(
          `Test database name "${dbName}" is not test-scoped (must contain 'test'). Refusing to proceed.`
        );
      }
    } catch (err) {
      if (err.message.includes("test-scoped")) {
        throw err;
      }
      throw new Error("Invalid TEST_DATABASE_URL format.");
    }

    return trimmedTest;
  }

  if (!devUrl || !devUrl.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  return devUrl.trim();
}

const connectionString = getDatabaseUrl();
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export default prisma;
