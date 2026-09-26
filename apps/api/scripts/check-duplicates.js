import "dotenv/config";
import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const dups = await prisma.$queryRawUnsafe(`
      SELECT "examId", "resolvedStudentNumber", COUNT(*)::int as cnt
      FROM "ExamSubmission"
      WHERE "status" = 'FINAL' AND "resolvedStudentNumber" IS NOT NULL
      GROUP BY "examId", "resolvedStudentNumber"
      HAVING COUNT(*) > 1;
    `);
    console.log("Existing duplicate FINAL submissions count:", dups.length);
    if (dups.length > 0) {
      console.log("Duplicate records:", dups);
    }
  } catch (err) {
    console.error("Error querying duplicates:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
