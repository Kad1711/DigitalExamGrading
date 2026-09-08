import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { normalizeExamCode } from "../src/utils/exam-code.js";
import * as examCodeService from "../src/services/exam-code.service.js";

async function getTestTeacherAndSubject() {
  const teacherUser = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });
  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  return {
    user: { id: teacherUser.id, role: teacherUser.role },
    teacherId: teacherUser.teacher.id,
    subjectId: subject.id,
    classId: cls.id,
  };
}

test("Exam Code Normalization & Legacy Compatibility Suite", async (t) => {
  // Test 1: Pure normalization unit tests
  await t.test("1. normalizeExamCode handles single, double, triple digits and rejects non-numeric", () => {
    assert.equal(normalizeExamCode("1"), "001");
    assert.equal(normalizeExamCode("01"), "001");
    assert.equal(normalizeExamCode("001"), "001");
    assert.equal(normalizeExamCode("10"), "010");
    assert.equal(normalizeExamCode("101"), "101");
    assert.equal(normalizeExamCode("999"), "999");
    assert.equal(normalizeExamCode(1), "001");
    assert.equal(normalizeExamCode(2), "002");
    assert.equal(normalizeExamCode(10), "010");
    assert.equal(normalizeExamCode("0"), "000");

    assert.throws(() => normalizeExamCode(""), (err) => err.code === "INVALID_EXAM_CODE");
    assert.throws(() => normalizeExamCode("abc"), (err) => err.code === "INVALID_EXAM_CODE");
    assert.throws(() => normalizeExamCode("1000"), (err) => err.code === "INVALID_EXAM_CODE");
    assert.throws(() => normalizeExamCode("-1"), (err) => err.code === "INVALID_EXAM_CODE");
    assert.throws(() => normalizeExamCode(null), (err) => err.code === "INVALID_EXAM_CODE");
  });

  // Test 2: Duplicate protection with normalization
  await t.test("2. Duplicate protection: DB has '01', attempt to create '001' or '1' is rejected", async () => {
    const fixtures = await getTestTeacherAndSubject();

    const exam = await prisma.exam.create({
      data: {
        title: `Test Exam Norm ${Date.now()}`,
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 10,
        maxScore: 10,
        scoringType: "EQUAL",
        status: "DRAFT",
      },
    });

    // Directly seed legacy non-padded code '01' into DB
    await prisma.examCode.create({
      data: { examId: exam.id, code: "01" },
    });

    // Attempt 1: Create '001' -> must be rejected as duplicate
    await assert.rejects(
      async () => {
        await examCodeService.createExamCode(exam.id, "001", fixtures.user);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "EXAM_CODE_DUPLICATE");
        return true;
      }
    );

    // Attempt 2: Create '1' -> must also be rejected as duplicate
    await assert.rejects(
      async () => {
        await examCodeService.createExamCode(exam.id, "1", fixtures.user);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "EXAM_CODE_DUPLICATE");
        return true;
      }
    );

    // Attempt 3: Create '2' -> succeeds and is stored as '002'
    const code002 = await examCodeService.createExamCode(exam.id, "2", fixtures.user);
    assert.equal(code002.code, "002");

    // Clean up
    await prisma.examCode.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
  });

  // Test 3: OMR lookup matching legacy DB code "01" against OMR recognized "001"
  await t.test("3. OMR lookup matching: OMR '001' matches DB '01', OMR '002' matches DB '02'", async () => {
    const fixtures = await getTestTeacherAndSubject();

    const exam = await prisma.exam.create({
      data: {
        title: `Test Exam OMR Match ${Date.now()}`,
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 10,
        maxScore: 10,
        scoringType: "EQUAL",
        status: "PUBLISHED",
      },
    });

    // Seed legacy codes "01" and "02"
    const ec1 = await prisma.examCode.create({
      data: { examId: exam.id, code: "01" },
    });
    const ec2 = await prisma.examCode.create({
      data: { examId: exam.id, code: "02" },
    });

    // Simulate OMR detection returning "001" and "002"
    const allExamCodes = await prisma.examCode.findMany({
      where: { examId: exam.id },
      include: { answerKeys: true },
    });

    // Match 001 -> DB "01"
    const recognized1 = "001";
    const normRec1 = normalizeExamCode(recognized1);
    const match1 = allExamCodes.find((ec) => {
      try {
        return normalizeExamCode(ec.code) === normRec1;
      } catch {
        return ec.code === recognized1;
      }
    });

    assert.ok(match1);
    assert.equal(match1.id, ec1.id);
    assert.equal(match1.code, "01", "DB code remains untouched as '01'");

    // Match 002 -> DB "02"
    const recognized2 = "002";
    const normRec2 = normalizeExamCode(recognized2);
    const match2 = allExamCodes.find((ec) => {
      try {
        return normalizeExamCode(ec.code) === normRec2;
      } catch {
        return ec.code === recognized2;
      }
    });

    assert.ok(match2);
    assert.equal(match2.id, ec2.id);
    assert.equal(match2.code, "02", "DB code remains untouched as '02'");

    // Clean up
    await prisma.examCode.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
  });

  // Test 4: Answer key import normalization (01, 001, 1 resolve to same code)
  await t.test("4. Answer key import normalization: 01, 001, 1 map to existing code '01'", async () => {
    const { validateImportRows } = await import("../src/services/answer-key-import.service.js");
    const fakeExam = { questionCount: 2, maxScore: 10, scoringType: "EQUAL" };
    const existingCodes = [{ id: "code-id-1", code: "01" }];

    // Row with code "001" matching existing code "01"
    const rows = [
      { rowNumber: 2, examCode: "001", questionNumber: 1, correctAnswer: "A", score: null },
      { rowNumber: 3, examCode: "001", questionNumber: 2, correctAnswer: "B", score: null },
    ];

    const result = validateImportRows(rows, fakeExam, existingCodes);
    assert.equal(result.errors.length, 0, "No errors should occur when 001 maps to 01");
    assert.equal(result.groupedByCode.get("01").length, 2);
  });

  // Test 5: Answer key import rejects duplicate question numbers across 01 and 001
  await t.test("5. Answer key import rejects duplicate question numbers across '01' and '001'", async () => {
    const { validateImportRows } = await import("../src/services/answer-key-import.service.js");
    const fakeExam = { questionCount: 2, maxScore: 10, scoringType: "EQUAL" };
    const existingCodes = [{ id: "code-id-1", code: "01" }];

    // Row 1 uses "01", Row 2 uses "001" for same question 1 -> duplicate!
    const rows = [
      { rowNumber: 2, examCode: "01", questionNumber: 1, correctAnswer: "A", score: null },
      { rowNumber: 3, examCode: "001", questionNumber: 1, correctAnswer: "B", score: null },
    ];

    const result = validateImportRows(rows, fakeExam, existingCodes);
    assert.ok(result.errors.some((e) => e.message.includes("trung lap cau hoi so 1")));
  });

  // Test 6: Unicode font resolution
  await t.test("6. Unicode font resolution returns valid font files on current environment", async () => {
    const { resolveUnicodeFont } = await import("../src/services/answer-sheet-pdf.service.js");
    const font = resolveUnicodeFont();
    assert.ok(font, "A valid Unicode TrueType font must be resolved");
    assert.ok(font.regular, "regular font path must exist");
    assert.ok(font.bold, "bold font path must exist");
  });

  // Test 7: OMR Client error mapping
  await t.test("7. OMR Client error mapping: maps 422 MARKERS_NOT_FOUND and logs diagnostic", async () => {
    const { analyzeOmrSheet } = await import("../src/services/omr-client.service.js");

    // Mock global fetch to simulate FastAPI 422 response
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        status: 422,
        json: async () => ({
          detail: {
            code: "MARKERS_NOT_FOUND",
            message: "MARKERS_NOT_FOUND: Missing markers in quadrants: TOP_RIGHT, BOTTOM_RIGHT",
          },
        }),
      });

      await assert.rejects(
        async () => {
          await analyzeOmrSheet(Buffer.from("dummy"), {}, "test.png");
        },
        (err) => {
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, "OMR_MARKERS_NOT_FOUND");
          assert.ok(err.message.includes("Không tìm thấy đủ 4 điểm định vị góc phiếu"));
          return true;
        }
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
