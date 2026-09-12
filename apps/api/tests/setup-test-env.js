import "dotenv/config";
import path from "node:path";
import os from "node:os";

// 1. Force NODE_ENV to test
process.env.NODE_ENV = "test";

// 2. Set default local test DB url dynamically from DATABASE_URL if not explicitly provided
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/exam_grading_test";
    process.env.TEST_DATABASE_URL = url.toString();
  } catch {
    // Ignore, validation in prisma.js will handle format error
  }
}

// 3. Isolated test storage directory
if (!process.env.TEST_SUBMISSION_STORAGE_DIR) {
  process.env.TEST_SUBMISSION_STORAGE_DIR = path.join(
    os.tmpdir(),
    "digitalexam-test-storage"
  );
}

// 4. Safe confirmation banner (never print credentials, only database name)
try {
  if (process.env.TEST_DATABASE_URL) {
    const parsed = new URL(process.env.TEST_DATABASE_URL);
    const dbName = parsed.pathname.replace(/^\//, "").split("?")[0];
    console.log("\n==================================================");
    console.log(`Test DB selected: ${dbName}`);
    console.log("Normal dev DB:   NOT USED");
    console.log(`Test Storage:    ${process.env.TEST_SUBMISSION_STORAGE_DIR}`);
    console.log("==================================================\n");
  }
} catch {
  // Ignored
}
