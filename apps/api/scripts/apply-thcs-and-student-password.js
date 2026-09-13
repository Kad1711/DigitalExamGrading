import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

let testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl && process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    u.pathname = "/exam_grading_test";
    testDbUrl = u.toString();
  } catch {}
}

const dbUrls = Array.from(new Set([
  process.env.DATABASE_URL,
  testDbUrl,
].filter(Boolean)));

async function applyToDb(url) {
  const isTest = url.includes("test");
  console.log(`\n=== Applying updates to ${isTest ? "TEST DB" : "DEV DB"} ===`);
  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    // 1. Add initialPassword column to Student table if not exists
    console.log('Adding "initialPassword" column to Student table if not exists...');
    await client.query(`
      ALTER TABLE "Student" 
      ADD COLUMN IF NOT EXISTS "initialPassword" VARCHAR(255) DEFAULT '123456';
    `);
    await client.query(`
      UPDATE "Student" 
      SET "initialPassword" = '123456' 
      WHERE "initialPassword" IS NULL;
    `);
    console.log('✓ "initialPassword" column verified.');

    // 2. Upsert THCS Grades (6, 7, 8, 9)
    const thcsGrades = [
      { level: 6, name: "Khối 6" },
      { level: 7, name: "Khối 7" },
      { level: 8, name: "Khối 8" },
      { level: 9, name: "Khối 9" },
      { level: 10, name: "Khối 10" },
      { level: 11, name: "Khối 11" },
      { level: 12, name: "Khối 12" },
    ];

    for (const g of thcsGrades) {
      const res = await client.query(
        `SELECT id FROM "Grade" WHERE level = $1`,
        [g.level]
      );
      if (res.rowCount === 0) {
        const id = `grade_${g.level}_${Date.now()}`;
        await client.query(
          `INSERT INTO "Grade" (id, level, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`,
          [id, g.level, g.name]
        );
        console.log(`✓ Created Grade: ${g.name} (level ${g.level})`);
      } else {
        await client.query(
          `UPDATE "Grade" SET name = $1, "updatedAt" = NOW() WHERE level = $2`,
          [g.name, g.level]
        );
      }
    }
    console.log("✓ Grades 6-12 verified.");

    // 3. Update existing student accounts to format: className_sbd@digitalexam.edu.vn
    const enrollments = await client.query(`
      SELECT se.id as "enrollmentId", se."classId", c.name as "className", s.id as "studentId", s."studentCode", s."userId", u.email
      FROM "StudentEnrollment" se
      JOIN "Class" c ON c.id = se."classId"
      JOIN "Student" s ON s.id = se."studentId"
      JOIN "User" u ON u.id = s."userId"
    `);

    for (const row of enrollments.rows) {
      const cleanClass = (row.className || "lop").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const rawCode = (row.studentCode || "0").trim();
      const paddedCode = /^\d+$/.test(rawCode) && rawCode.length === 1 ? `0${rawCode}` : rawCode;
      const cleanCode = paddedCode.replace(/[^a-zA-Z0-9]/g, "");
      const newEmail = `${cleanClass}_${cleanCode}@digitalexam.edu.vn`.toLowerCase();

      if (row.email !== newEmail) {
        const emailCheck = await client.query(
          `SELECT id FROM "User" WHERE email = $1 AND id != $2`,
          [newEmail, row.userId]
        );
        if (emailCheck.rowCount === 0) {
          await client.query(
            `UPDATE "User" SET email = $1 WHERE id = $2`,
            [newEmail, row.userId]
          );
          console.log(`✓ Updated email: ${row.email} -> ${newEmail}`);
        }
      }
    }
    console.log("✓ Existing student accounts standardized.");

  } catch (err) {
    console.error(`Error updating ${url}:`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  for (const url of dbUrls) {
    await applyToDb(url);
  }
  console.log("\n✅ All database schema & data updates applied successfully.");
}

main().catch((err) => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
