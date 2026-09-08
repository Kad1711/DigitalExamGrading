import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as exportService from "../src/services/result-export.service.js";

async function setupExportContext() {
  const teacherUserA = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });
  if (!teacherUserA?.teacher) throw new Error("No Teacher A");

  let teacherUserB = await prisma.user.findFirst({
    where: { role: "TEACHER", id: { not: teacherUserA.id } },
    include: { teacher: true },
  });
  if (!teacherUserB?.teacher) {
    teacherUserB = await prisma.user.create({
      data: {
        email: `export_test_b_${Date.now()}@digitalexam.local`,
        passwordHash: "dummyhash",
        role: "TEACHER",
        status: "ACTIVE",
        teacher: {
          create: {
            teacherCode: `ETB_${Date.now().toString().slice(-6)}`,
            fullName: "Export Test Teacher B",
          },
        },
      },
      include: { teacher: true },
    });
  }

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  // Published CLOSED exam
  const exam = await prisma.exam.create({
    data: {
      title: `Export Test Exam ${Date.now()}`,
      teacherId: teacherUserA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
      resultsPublishedAt: new Date(),
      resultsPublishedByUserId: teacherUserA.id,
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: exam.id, code: "001" },
  });
  for (let q = 1; q <= 4; q++) {
    await prisma.answerKey.create({
      data: {
        examCodeId: examCode.id,
        questionNumber: q,
        correctAnswer: "A",
        score: new Prisma.Decimal("2.5000"),
      },
    });
  }

  const template = await prisma.answerSheetTemplate.create({
    data: { examId: exam.id, version: 1, layoutJson: {} },
  });

  // 3 FINAL submissions with unique SBDs
  for (let i = 1; i <= 3; i++) {
    await prisma.examSubmission.create({
      data: {
        examId: exam.id,
        examCodeId: examCode.id,
        answerSheetTemplateId: template.id,
        gradedByUserId: teacherUserA.id,
        status: "FINAL",
        detectedStudentNumber: `40000${i}`,
        resolvedStudentNumber: `40000${i}`,
        studentNumberOmrStatus: "DETECTED",
        identityNeedsReview: false,
        originalImageStorageKey: `export-test/${Date.now()}-${i}/original.jpg`,
        originalImageSha256: `sha256_export_${Date.now()}_${i}`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 1000,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 4 - i + 1,
        incorrectCount: i - 1,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal((2.5 * (4 - i + 1)).toFixed(4)),
        finalizedAt: new Date(),
      },
    });
  }

  // Unpublished exam (for guard test)
  const unpubExam = await prisma.exam.create({
    data: {
      title: `Unpub Export Test Exam ${Date.now()}`,
      teacherId: teacherUserA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
    },
  });

  return {
    teacherA: { id: teacherUserA.id, role: "TEACHER" },
    teacherB: { id: teacherUserB.id, role: "TEACHER" },
    admin: { id: adminUser.id, role: "ADMIN" },
    exam,
    unpubExam,
    examCode,
    template,
  };
}

test("Phase 8 — Result Export & Data Integrity Audit", async (t) => {
  const ctx = await setupExportContext();
  const examId = ctx.exam.id;

  await t.test("T8E.1 — exportResultsXlsx: Programmatically verify ExcelJS workbook content", async () => {
    const buffer = await exportService.exportResultsXlsx({ examId, user: ctx.teacherA });
    assert.ok(Buffer.isBuffer(buffer), "Should return a Buffer");
    assert.strictEqual(buffer[0], 0x50, "Magic byte PK");
    assert.strictEqual(buffer[1], 0x4b, "Magic byte PK");

    // Load workbook with ExcelJS to verify structure and content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Kết quả");
    assert.ok(sheet, "Worksheet 'Kết quả' should exist");

    // Header check
    const headerRow = sheet.getRow(1);
    assert.strictEqual(headerRow.getCell(1).value, "STT");
    assert.strictEqual(headerRow.getCell(2).value, "Số báo danh");
    assert.strictEqual(headerRow.getCell(3).value, "Mã đề");
    assert.strictEqual(headerRow.getCell(4).value, "Số câu đúng");
    assert.strictEqual(headerRow.getCell(7).value, "Điểm");

    // Verify candidate rows (3 submissions: rows 2, 3, 4)
    assert.strictEqual(sheet.rowCount, 5, "1 header + 3 candidates + 1 summary = 5 rows");

    const row2 = sheet.getRow(2);
    assert.strictEqual(row2.getCell(2).value, "400001");
    assert.strictEqual(row2.getCell(3).value, "001");
    assert.strictEqual(row2.getCell(4).value, 4); // correctCount
    assert.strictEqual(row2.getCell(7).value, 10); // numeric finalScore
    assert.strictEqual(typeof row2.getCell(7).value, "number", "Student score must be a number, not formula");

    // Verify summary row has formulas
    const summaryRow = sheet.getRow(5);
    assert.strictEqual(summaryRow.getCell(2).value, "TỔNG CỘNG");
    assert.ok(summaryRow.getCell(4).value?.formula, "Summary correct count should be a formula");
    assert.ok(summaryRow.getCell(7).value?.formula, "Summary average score should be a formula");
  });

  await t.test("T8E.2 — exportResultsCsv: verify UTF-8 BOM, Vietnamese headers, and content", async () => {
    const csv = await exportService.exportResultsCsv({ examId, user: ctx.teacherA });
    assert.strictEqual(typeof csv, "string", "CSV should be a string");
    assert.ok(csv.startsWith("\uFEFF"), "CSV must start with UTF-8 BOM");

    const lines = csv.split("\r\n");
    assert.ok(lines[0].includes("Số báo danh"));
    assert.ok(lines[0].includes("Mã đề"));
    assert.ok(lines[0].includes("Điểm"));

    // Candidate rows
    assert.ok(csv.includes("400001"));
    assert.ok(csv.includes("400002"));
    assert.ok(csv.includes("400003"));
  });

  await t.test("T8E.3 — Section 25 & 26: Formula injection protection in CSV & XLSX", async () => {
    // Create an exam with a dangerous SBD (=2+2, +SUM(1,1), -1+1, @SUM(A1:A2))
    const dangerousExam = await prisma.exam.create({
      data: {
        title: `Formula Injection Test ${Date.now()}`,
        teacherId: (await prisma.teacher.findFirst({ where: { userId: ctx.teacherA.id } })).id,
        subjectId: (await prisma.subject.findFirst()).id,
        classId: (await prisma.class.findFirst()).id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "CLOSED",
        resultsPublishedAt: new Date(),
        resultsPublishedByUserId: ctx.teacherA.id,
      },
    });

    const sub = await prisma.examSubmission.create({
      data: {
        examId: dangerousExam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        detectedStudentNumber: "=2+2",
        candidateStudentNumber: "=2+2",
        studentNumberOmrStatus: "DETECTED",
        resolvedStudentNumber: "=2+2", // Dangerous formula payload
        identityNeedsReview: false,
        originalImageStorageKey: "test",
        originalImageSha256: `sha_inj_${Date.now()}`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "+SUM(1,1)", // Dangerous formula payload in exam code
        correctCount: 4,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("10.0000"),
        finalizedAt: new Date(),
      },
    });

    // CSV test
    const csv = await exportService.exportResultsCsv({ examId: dangerousExam.id, user: ctx.teacherA });
    // Must be sanitized to "'=2+2"
    assert.ok(csv.includes("'=2+2"), "Dangerous formula in CSV should be escaped with leading quote");
    assert.ok(csv.includes("'+SUM(1,1)"), "Dangerous formula in CSV should be escaped with leading quote");

    // XLSX test
    const xlsxBuf = await exportService.exportResultsXlsx({ examId: dangerousExam.id, user: ctx.teacherA });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBuf);
    const sheet = wb.getWorksheet("Kết quả");
    const cellSbd = sheet.getRow(2).getCell(2).value;
    assert.strictEqual(cellSbd, "'=2+2", "XLSX dangerous cell must be stored as literal text");

    await prisma.examSubmission.delete({ where: { id: sub.id } });
    await prisma.exam.delete({ where: { id: dangerousExam.id } });
  });

  await t.test("T8E.4 — Section 21: Export dataset consistency guard (PUBLISHED_RESULTS_INCONSISTENT)", async () => {
    // If a PROVISIONAL submission exists while resultsPublishedAt != null, export MUST fail safely
    const inconsistentSub = await prisma.examSubmission.create({
      data: {
        examId,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherA.id,
        status: "PROVISIONAL",
        detectedStudentNumber: "499999",
        candidateStudentNumber: "499999",
        studentNumberOmrStatus: "DETECTED",
        resolvedStudentNumber: "499999",
        identityNeedsReview: false,
        originalImageStorageKey: "incon",
        originalImageSha256: `sha_incon_${Date.now()}`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 2,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 2,
      },
    });

    await assert.rejects(
      () => exportService.exportResultsXlsx({ examId, user: ctx.teacherA }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "PUBLISHED_RESULTS_INCONSISTENT");
        return true;
      }
    );

    await assert.rejects(
      () => exportService.exportResultsCsv({ examId, user: ctx.teacherA }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "PUBLISHED_RESULTS_INCONSISTENT");
        return true;
      }
    );

    await prisma.examSubmission.delete({ where: { id: inconsistentSub.id } });
  });

  await t.test("T8E.5 — Section 20: NOT published exam returns 422 RESULTS_NOT_PUBLISHED", async () => {
    await assert.rejects(
      () => exportService.exportResultsXlsx({ examId: ctx.unpubExam.id, user: ctx.teacherA }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "RESULTS_NOT_PUBLISHED");
        return true;
      }
    );

    await assert.rejects(
      () => exportService.exportResultsCsv({ examId: ctx.unpubExam.id, user: ctx.teacherA }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "RESULTS_NOT_PUBLISHED");
        return true;
      }
    );
  });

  await t.test("T8E.6 — Section 18: ARCHIVED exam with published results can still export", async () => {
    // Set exam status to ARCHIVED
    await prisma.exam.update({ where: { id: examId }, data: { status: "ARCHIVED" } });

    const buffer = await exportService.exportResultsXlsx({ examId, user: ctx.teacherA });
    assert.ok(Buffer.isBuffer(buffer));

    const csv = await exportService.exportResultsCsv({ examId, user: ctx.teacherA });
    assert.ok(csv.startsWith("\uFEFF"));

    // Restore to CLOSED
    await prisma.exam.update({ where: { id: examId }, data: { status: "CLOSED" } });
  });

  await t.test("T8E.7 — Section 11: Admin denied export (403 FORBIDDEN)", async () => {
    await assert.rejects(
      () => exportService.exportResultsXlsx({ examId, user: ctx.admin }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "FORBIDDEN");
        return true;
      }
    );

    await assert.rejects(
      () => exportService.exportResultsCsv({ examId, user: ctx.admin }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "FORBIDDEN");
        return true;
      }
    );
  });

  await t.test("T8E.8 — Section 11: Other Teacher denied export (403 EXAM_ACCESS_DENIED)", async () => {
    await assert.rejects(
      () => exportService.exportResultsXlsx({ examId, user: ctx.teacherB }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "EXAM_ACCESS_DENIED");
        return true;
      }
    );

    await assert.rejects(
      () => exportService.exportResultsCsv({ examId, user: ctx.teacherB }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "EXAM_ACCESS_DENIED");
        return true;
      }
    );
  });

  // Cleanup
  await prisma.examSubmission.deleteMany({ where: { examId } });
  await prisma.answerSheetTemplate.deleteMany({ where: { examId } });
  await prisma.answerKey.deleteMany({ where: { examCodeId: ctx.examCode.id } });
  await prisma.examCode.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
  await prisma.exam.delete({ where: { id: ctx.unpubExam.id } });
});
