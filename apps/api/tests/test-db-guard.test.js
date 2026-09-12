import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDatabaseUrl } from "../src/config/prisma.js";

describe("Test Database Isolation Guard", () => {
  const origEnv = { ...process.env };

  function restoreEnv() {
    process.env.NODE_ENV = origEnv.NODE_ENV;
    process.env.DATABASE_URL = origEnv.DATABASE_URL;
    process.env.TEST_DATABASE_URL = origEnv.TEST_DATABASE_URL;
  }

  it("throws if TEST_DATABASE_URL is missing in test environment", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TEST_DATABASE_URL;
    assert.throws(() => getDatabaseUrl(), {
      message: /TEST_DATABASE_URL is required when NODE_ENV=test/,
    });
    restoreEnv();
  });

  it("throws if TEST_DATABASE_URL equals DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_db";
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_db";
    assert.throws(() => getDatabaseUrl(), {
      message: /TEST_DATABASE_URL matches DATABASE_URL/,
    });
    restoreEnv();
  });

  it("throws if TEST_DATABASE_URL database name does not contain 'test'", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_db";
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_prod";
    assert.throws(() => getDatabaseUrl(), {
      message: /not test-scoped \(must contain 'test'\)/,
    });
    restoreEnv();
  });

  it("accepts valid test-scoped TEST_DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_db";
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_test?schema=public";
    const resolved = getDatabaseUrl();
    assert.equal(resolved, "postgresql://user:pass@localhost:5432/exam_grading_test?schema=public");
    restoreEnv();
  });

  it("returns normal DATABASE_URL in non-test environment", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/exam_grading_db";
    const resolved = getDatabaseUrl();
    assert.equal(resolved, "postgresql://user:pass@localhost:5432/exam_grading_db");
    restoreEnv();
  });
});
