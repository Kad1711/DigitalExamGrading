import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as classService from "../src/services/class.service.js";
import * as submissionService from "../src/services/submission.service.js";
import * as studentResultService from "../src/services/student-result.service.js";
import { requireClassStudentAccess } from "../src/middlewares/class-access.middleware.js";

// Helper to mock global fetch for OMR responses
function mockOmrFetch(omrPayload) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/omr/analyze")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: omrPayload,
        }),
      };
    }
    return originalFetch(url, options);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function setupPhase1Fixtures() {
  const ts = Date.now();

  // 1. Teacher 1 (Homeroom/Assigned teacher)
  const teacherUser1 = await prisma.user.create({
    data: {
      email: `teacher_assigned_${ts}@digitalexam.local`,
      passwordHash: "dummyhash",
      role: "TEACHER",
      status: "ACTIVE",
      teacher: {
        create: {
          teacherCode: `T_ASG_${ts.toString().slice(-6)}`,
          fullName: "Teacher Assigned",
        },
      },
    },
    include: { teacher: true },
  });

  // 2. Teacher 2 (Unassigned teacher for Class A)
  const teacherUser2 = await prisma.user.create({
    data: {
      email: `teacher_unassigned_${ts}@digitalexam.local`,
      passwordHash: "dummyhash",
      role: "TEACHER",
      status: "ACTIVE",
      teacher: {
        create: {
          teacherCode: `T_UNASG_${ts.toString().slice(-6)}`,
          fullName: "Teacher Unassigned",
        },
      },
    },
    include: { teacher: true },
  });

  // 3. Admin user
  let adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: `admin_${ts}@digitalexam.local`,
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });
  }

  // 4. Grade & Subject
  const grade = await prisma.grade.findFirst();
  const subject = await prisma.subject.findFirst();

  // 5. Class
  const testClass = await classService.createClass({
    name: `CLS_REM_${ts.toString().slice(-4)}`,
    gradeId: grade.id,
    teacherUserId: teacherUser1.id,
  });

  // Ensure TeachingAssignment exists for teacherUser1
  const existingAssign = await prisma.teachingAssignment.findFirst({
    where: { classId: testClass.id, teacherId: teacherUser1.teacher.id },
  });
  if (!existingAssign) {
    await prisma.teachingAssignment.create({
      data: {
        classId: testClass.id,
        teacherId: teacherUser1.teacher.id,
        subjectId: subject.id,
        academicYearId: testClass.academicYearId,
      },
    });
  }

  // 6. Student enrolled in testClass
  const studentRegistered = await classService.addStudentToClass(testClass.id, {
    studentCode: `SBD_${ts.toString().slice(-6)}`,
    fullName: "Registered Student One",
    password: "SecretPassword123",
  });

  // Second student in class for fuzzy test
  const studentFuzzy = await classService.addStudentToClass(testClass.id, {
    studentCode: `FUZZY_${ts.toString().slice(-6)}`,
    fullName: "Fuzzy Candidate",
  });

  // 7. Exam owned by teacherUser1
  const exam = await prisma.exam.create({
    data: {
      title: `Remediation Phase 1 Exam ${ts}`,
      teacherId: teacherUser1.teacher.id,
      subjectId: subject.id,
      classId: testClass.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal(10),
      scoringType: "EQUAL",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: exam.id, code: "101" },
  });

  await prisma.answerKey.createMany({
    data: [
      { examCodeId: examCode.id, questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal(2.5) },
    ],
  });

  const template = await prisma.answerSheetTemplate.create({
    data: {
      examId: exam.id,
      version: 1,
      pageCount: 1,
      layoutJson: { bubbleRadius: 10 },
    },
  });

  // Register only studentRegistered as ExamCandidate
  const candidate = await prisma.examCandidate.create({
    data: {
      examId: exam.id,
      studentId: studentRegistered.studentId,
      studentNumber: studentRegistered.studentCode,
    },
  });

  return {
    ts,
    teacherUser1,
    teacherUser2,
    adminUser,
    testClass,
    studentRegistered,
    studentFuzzy,
    exam,
    examCode,
    template,
    candidate,
  };
}

test("Remediation Phase 1 — P0 Data Integrity & Security Suite", async (t) => {
  const ctx = await setupPhase1Fixtures();

  // =========================================================================
  // FINDING-004: BOLA / IDOR on Class Students & initialPassword Leak
  // =========================================================================
  await t.test("F004.1 — requireClassStudentAccess blocks unassigned teacher with 403 FORBIDDEN", async () => {
    let errorCaught = null;
    const req = {
      user: { id: ctx.teacherUser2.id, role: "TEACHER" },
      params: { classId: ctx.testClass.id },
    };
    const res = {};
    await requireClassStudentAccess(req, res, (err) => {
      errorCaught = err;
    });

    assert.ok(errorCaught, "Expected 403 FORBIDDEN for unassigned teacher");
    assert.equal(errorCaught.statusCode, 403);
    assert.equal(errorCaught.code, "FORBIDDEN");
  });

  await t.test("F004.2 — requireClassStudentAccess permits assigned teacher and admin", async () => {
    let assignedTeacherCalled = false;
    await requireClassStudentAccess(
      { user: { id: ctx.teacherUser1.id, role: "TEACHER" }, params: { classId: ctx.testClass.id } },
      {},
      (err) => {
        if (!err) assignedTeacherCalled = true;
      }
    );
    assert.equal(assignedTeacherCalled, true, "Assigned teacher must be permitted");

    let adminCalled = false;
    await requireClassStudentAccess(
      { user: { id: ctx.adminUser.id, role: "SUPER_ADMIN" }, params: { classId: ctx.testClass.id } },
      {},
      (err) => {
        if (!err) adminCalled = true;
      }
    );
    assert.equal(adminCalled, true, "Super Admin must be permitted");
  });

  await t.test("F004.3 — listClassStudents MUST NOT leak initialPassword in payload", async () => {
    const students = await classService.listClassStudents(ctx.testClass.id);
    assert.ok(students.length >= 1, "Class should have students");
    const target = students.find((s) => s.studentId === ctx.studentRegistered.studentId);
    assert.ok(target, "Registered student must be in list");
    assert.strictEqual(
      target.initialPassword,
      undefined,
      "Security leak: initialPassword must NOT be present in listClassStudents response"
    );
  });

  // =========================================================================
  // FINDING-001: Untrusted OMR Candidate SBD & Removal of Heuristic Auto-Link
  // =========================================================================
  await t.test("F001.1 — SBD not in exam roster forces identityNeedsReview=true and status=PROVISIONAL", async () => {
    const unlistedSbd = `UNLISTED_${ctx.ts.toString().slice(-4)}`;
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.98 },
      studentNumber: { value: unlistedSbd, status: "OK", confidence: 0.95 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_UNLISTED_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "unlisted.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(result.identityNeedsReview, true, "Unregistered SBD must set identityNeedsReview=true");
      assert.equal(result.status, "PROVISIONAL", "Unregistered SBD must force status to PROVISIONAL");
      assert.equal(result.finalScore, null, "PROVISIONAL submission must not have finalScore");
      assert.notEqual(result.provisionalScore, null, "PROVISIONAL submission must have provisionalScore");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F001.2 — SBD with low confidence (< 0.85) forces identityNeedsReview=true and status=PROVISIONAL", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.98 },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.72 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_LOWCONF_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "lowconf.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(result.identityNeedsReview, true, "Low confidence SBD must set identityNeedsReview=true");
      assert.equal(result.status, "PROVISIONAL", "Low confidence SBD must force status to PROVISIONAL");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F001.3 — Removal of heuristic auto-linking: unmatched SBD does NOT create ExamCandidate", async () => {
    // SBD substring matches studentFuzzy.studentCode
    const substringSbd = ctx.studentFuzzy.studentCode.slice(-4);
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.98 },
      studentNumber: { value: substringSbd, status: "OK", confidence: 0.95 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_FUZZY_${Date.now()}`);
      await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "fuzzy.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      // Assert that NO examCandidate was auto-created for studentFuzzy
      const autoCreatedCandidate = await prisma.examCandidate.findUnique({
        where: { examId_studentId: { examId: ctx.exam.id, studentId: ctx.studentFuzzy.studentId } },
      });
      assert.equal(
        autoCreatedCandidate,
        null,
        "Security flaw: Heuristic auto-link must NOT create ExamCandidate record"
      );
    } finally {
      restoreFetch();
    }
  });

  // =========================================================================
  // FINDING-002: Exam Code / Answer Key Misclassification
  // =========================================================================
  await t.test("F002.1 — Ambiguous Exam Code (UNCERTAIN status / low confidence) forces status=PROVISIONAL", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "UNCERTAIN", confidence: 0.75 },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_AMBIG_EXAMCODE_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "ambig_code.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(
        result.status,
        "PROVISIONAL",
        "Ambiguous exam code must force status=PROVISIONAL to prevent silent misgrading"
      );
      assert.equal(result.finalScore, null, "Ambiguous exam code must NOT produce finalScore");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F002.2 — examCode status OK but confidence missing forces status=PROVISIONAL (Fail-Closed)", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK" }, // confidence missing
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_EXAMCODE_NOCONF_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "noconf_code.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(
        result.status,
        "PROVISIONAL",
        "Missing exam code confidence must fail-closed to PROVISIONAL"
      );
      assert.equal(result.finalScore, null, "Missing exam code confidence must NOT produce finalScore");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F002.3 — examCode confidence null forces status=PROVISIONAL (Fail-Closed)", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: null },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_EXAMCODE_NULLCONF_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "nullconf_code.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(
        result.status,
        "PROVISIONAL",
        "Null exam code confidence must fail-closed to PROVISIONAL"
      );
      assert.equal(result.finalScore, null, "Null exam code confidence must NOT produce finalScore");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F002.4 — examCode confidence non-number (string/NaN) forces status=PROVISIONAL (Fail-Closed)", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: "0.99" }, // string, not number
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_EXAMCODE_STRCONF_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "strconf_code.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(
        result.status,
        "PROVISIONAL",
        "Non-number exam code confidence must fail-closed to PROVISIONAL"
      );
      assert.equal(result.finalScore, null, "Non-number exam code confidence must NOT produce finalScore");
    } finally {
      restoreFetch();
    }
  });

  await t.test("F001.4 — studentNumber confidence missing forces status=PROVISIONAL (Fail-Closed)", async () => {
    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.99 },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK" }, // confidence missing
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg = Buffer.from(`TEST_IMAGE_SBD_NOCONF_${Date.now()}`);
      const result = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg,
        originalFilename: "noconf_sbd.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });

      assert.equal(
        result.status,
        "PROVISIONAL",
        "Missing studentNumber confidence must fail-closed to PROVISIONAL"
      );
      assert.equal(result.identityNeedsReview, true, "Missing studentNumber confidence must set identityNeedsReview=true");
    } finally {
      restoreFetch();
    }
  });

  // =========================================================================
  // FINDING-006: Duplicate Submission per Candidate & Fail-Closed Student Results
  // =========================================================================
  await t.test("F006.1 — Candidate with existing active/FINAL submission cannot submit duplicate (rejected with 409)", async () => {
    // First: Create clean FINAL submission for studentRegistered
    const restoreFetch1 = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.99 },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    let firstSub;
    try {
      const dummyImg1 = Buffer.from(`TEST_IMAGE_CLEAN_FINAL_${Date.now()}`);
      firstSub = await submissionService.createSubmission({
        examId: ctx.exam.id,
        imageBuffer: dummyImg1,
        originalFilename: "clean_final.jpg",
        mimeType: "image/jpeg",
        user: ctx.teacherUser1,
      });
      assert.equal(firstSub.status, "FINAL", "First valid submission should be FINAL");
    } finally {
      restoreFetch1();
    }

    // Second: Attempt another submission for same candidate with DIFFERENT image (different SHA-256)
    const restoreFetch2 = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.99 },
      studentNumber: { value: ctx.studentRegistered.studentCode, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const dummyImg2 = Buffer.from(`TEST_IMAGE_DUP_CANDIDATE_${Date.now()}`);
      await assert.rejects(
        () =>
          submissionService.createSubmission({
            examId: ctx.exam.id,
            imageBuffer: dummyImg2,
            originalFilename: "dup_candidate.jpg",
            mimeType: "image/jpeg",
            user: ctx.teacherUser1,
          }),
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "DUPLICATE_CANDIDATE_SUBMISSION");
          return true;
        },
        "Must reject second submission for same candidate with 409 DUPLICATE_CANDIDATE_SUBMISSION"
      );
    } finally {
      restoreFetch2();
    }
  });

  await t.test("F006.2 — studentResultService fails closed when multiple submissions exist for candidate", async () => {
    // Create an exam and force two submissions with the same resolvedStudentNumber
    const studentUser = await prisma.user.findFirst({
      where: { student: { id: ctx.studentRegistered.studentId } },
    });

    // In a new exam where publication is done
    const multiSubExam = await prisma.exam.create({
      data: {
        title: `Multi Sub Exam ${ctx.ts}`,
        teacherId: ctx.teacherUser1.teacher.id,
        subjectId: ctx.exam.subjectId,
        classId: ctx.testClass.id,
        questionCount: 4,
        maxScore: new Prisma.Decimal(10),
        scoringType: "EQUAL",
        status: "PUBLISHED",
        publishedAt: new Date(),
        resultsPublishedAt: new Date(),
      },
    });

    const mExamCode = await prisma.examCode.create({
      data: { examId: multiSubExam.id, code: "101" },
    });

    const mTemplate = await prisma.answerSheetTemplate.create({
      data: { examId: multiSubExam.id, version: 1, pageCount: 1, layoutJson: {} },
    });

    await prisma.examCandidate.create({
      data: {
        examId: multiSubExam.id,
        studentId: ctx.studentRegistered.studentId,
        studentNumber: ctx.studentRegistered.studentCode,
      },
    });

    // Create 2 submissions directly in DB for this candidate
    await prisma.examSubmission.createMany({
      data: [
        {
          examId: multiSubExam.id,
          examCodeId: mExamCode.id,
          answerSheetTemplateId: mTemplate.id,
          gradedByUserId: ctx.teacherUser1.id,
          status: "FINAL",
          studentNumberOmrStatus: "OK",
          resolvedStudentNumber: ctx.studentRegistered.studentCode,
          identityNeedsReview: false,
          originalImageStorageKey: "dummy1.jpg",
          originalImageSha256: `sha1_${Date.now()}`,
          originalImageMimeType: "image/jpeg",
          originalImageSizeBytes: 100,
          omrOverallStatus: "SUCCESS",
          questionCountSnapshot: 4,
          maxScoreSnapshot: new Prisma.Decimal(10),
          scoringTypeSnapshot: "EQUAL",
          examCodeSnapshot: "101",
          correctCount: 4,
          incorrectCount: 0,
          blankCount: 0,
          unresolvedCount: 0,
          finalScore: new Prisma.Decimal(10),
        },
        {
          examId: multiSubExam.id,
          examCodeId: mExamCode.id,
          answerSheetTemplateId: mTemplate.id,
          gradedByUserId: ctx.teacherUser1.id,
          status: "FINAL",
          studentNumberOmrStatus: "OK",
          resolvedStudentNumber: ctx.studentRegistered.studentCode,
          identityNeedsReview: false,
          originalImageStorageKey: "dummy2.jpg",
          originalImageSha256: `sha2_${Date.now()}`,
          originalImageMimeType: "image/jpeg",
          originalImageSizeBytes: 100,
          omrOverallStatus: "SUCCESS",
          questionCountSnapshot: 4,
          maxScoreSnapshot: new Prisma.Decimal(10),
          scoringTypeSnapshot: "EQUAL",
          examCodeSnapshot: "101",
          correctCount: 2,
          incorrectCount: 2,
          blankCount: 0,
          unresolvedCount: 0,
          finalScore: new Prisma.Decimal(5),
        },
      ],
    });

    // listStudentExams MUST fail-closed: it must NOT return a score or blindly pick one
    const cards = await studentResultService.listStudentExams(studentUser.id);
    const targetCard = cards.find((c) => c.id === multiSubExam.id);
    assert.ok(targetCard, "Exam card should be listed");
    assert.strictEqual(
      targetCard.score,
      null,
      "Fail-closed: Conflicting multiple submissions must NOT return score in card summary"
    );

    // getStudentResultDetail MUST reject with 409 RESULT_IDENTITY_CONFLICT
    await assert.rejects(
      () => studentResultService.getStudentResultDetail(studentUser.id, multiSubExam.id),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "RESULT_IDENTITY_CONFLICT");
        return true;
      },
      "getStudentResultDetail must throw 409 RESULT_IDENTITY_CONFLICT when multiple submissions exist"
    );
  });

  await t.test("F006.3 — Concurrent submission race: Promise.allSettled enforces FINAL submissions <= 1", async () => {
    // Create an isolated candidate specifically for this concurrent race test
    const concurrentSbd = `CNCR_${ctx.ts.toString().slice(-4)}`;
    const concStudent = await classService.addStudentToClass(ctx.testClass.id, {
      studentCode: concurrentSbd,
      fullName: "Concurrent Candidate",
    });
    await prisma.examCandidate.create({
      data: {
        examId: ctx.exam.id,
        studentId: concStudent.studentId,
        studentNumber: concurrentSbd,
      },
    });

    const restoreFetch = mockOmrFetch({
      status: "SUCCESS",
      template: { examId: ctx.exam.id, templateId: ctx.template.id, pageNumber: 1, totalPages: 1 },
      examCode: { value: "101", status: "OK", confidence: 0.99 },
      studentNumber: { value: concurrentSbd, status: "OK", confidence: 0.99 },
      answers: [
        { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.99 },
        { questionNumber: 2, answer: "B", status: "MARKED", confidence: 0.99 },
        { questionNumber: 3, answer: "C", status: "MARKED", confidence: 0.99 },
        { questionNumber: 4, answer: "D", status: "MARKED", confidence: 0.99 },
      ],
      quality: { width: 800, height: 1200 },
    });

    try {
      const img1 = Buffer.from(`CONCURRENT_IMAGE_1_${Date.now()}`);
      const img2 = Buffer.from(`CONCURRENT_IMAGE_2_${Date.now()}`);

      const results = await Promise.allSettled([
        submissionService.createSubmission({
          examId: ctx.exam.id,
          imageBuffer: img1,
          originalFilename: "conc1.jpg",
          mimeType: "image/jpeg",
          user: ctx.teacherUser1,
        }),
        submissionService.createSubmission({
          examId: ctx.exam.id,
          imageBuffer: img2,
          originalFilename: "conc2.jpg",
          mimeType: "image/jpeg",
          user: ctx.teacherUser1,
        }),
      ]);

      const finalSubmissionsInDb = await prisma.examSubmission.findMany({
        where: {
          examId: ctx.exam.id,
          resolvedStudentNumber: concurrentSbd,
          status: "FINAL",
        },
      });

      assert.ok(
        finalSubmissionsInDb.length <= 1,
        `Concurrency violation: Found ${finalSubmissionsInDb.length} FINAL submissions for candidate ${concurrentSbd}, expected <= 1`
      );

      const fulfilledFinals = results.filter(
        (r) => r.status === "fulfilled" && r.value?.status === "FINAL"
      );
      assert.ok(
        fulfilledFinals.length <= 1,
        `Expected at most 1 fulfilled FINAL submission, but got ${fulfilledFinals.length}`
      );
    } finally {
      restoreFetch();
    }
  });
});
