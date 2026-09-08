import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as candidateService from "../src/services/exam-candidate.service.js";
import * as publicationService from "../src/services/result-publication.service.js";

async function setupCandidateFixture() {
  const ts = Date.now();

  const teacherA = await prisma.user.create({
    data: {
      email: `cand_t_a_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `CTA_${ts.toString().slice(-6)}`,
          fullName: "Cand Teacher A",
        },
      },
    },
    include: { teacher: true },
  });

  const teacherB = await prisma.user.create({
    data: {
      email: `cand_t_b_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `CTB_${ts.toString().slice(-6)}`,
          fullName: "Cand Teacher B",
        },
      },
    },
    include: { teacher: true },
  });

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  const student1 = await prisma.user.create({
    data: {
      email: `s1_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "STUDENT",
      student: {
        create: {
          studentCode: `S1_${ts.toString().slice(-6)}`,
          fullName: "Student One",
        },
      },
    },
    include: { student: true },
  });

  const student2 = await prisma.user.create({
    data: {
      email: `s2_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "STUDENT",
      student: {
        create: {
          studentCode: `S2_${ts.toString().slice(-6)}`,
          fullName: "Student Two",
        },
      },
    },
    include: { student: true },
  });

  const exam = await prisma.exam.create({
    data: {
      title: `Candidate Test Exam ${ts}`,
      teacherId: teacherA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
    },
  });

  const code = await prisma.examCode.create({
    data: { examId: exam.id, code: "001" },
  });

  const template = await prisma.answerSheetTemplate.create({
    data: { examId: exam.id, layoutJson: {} },
  });

  return {
    ts,
    teacherA,
    teacherB,
    student1,
    student2,
    exam,
    code,
    template,
  };
}

test("Phase 9 — Exam Candidate Mapping Suite", async (t) => {
  const ctx = await setupCandidateFixture();

  await t.test("TC.1 — Teacher owner can list candidates and eligible students", async () => {
    const list = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length, 0);

    const eligible = await candidateService.getEligibleStudents(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(Array.isArray(eligible), true);
  });

  await t.test("TC.2 — Other teacher is denied access (EXAM_ACCESS_DENIED)", async () => {
    await assert.rejects(
      () => candidateService.listExamCandidates(ctx.teacherB.id, ctx.exam.id),
      (err) => {
        assert.strictEqual(err.code, "EXAM_ACCESS_DENIED");
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  await t.test("TC.3 — Assign candidate creates valid mapping", async () => {
    const cand = await candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
      studentId: ctx.student1.student.id,
      studentNumber: "171101",
    });
    assert.strictEqual(cand.studentNumber, "171101");
    assert.strictEqual(cand.studentId, ctx.student1.student.id);

    const list = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].studentNumber, "171101");
  });

  await t.test("TC.4 — Duplicate studentNumber rejected with 409 EXAM_CANDIDATE_DUPLICATE_NUMBER", async () => {
    await assert.rejects(
      () =>
        candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
          studentId: ctx.student2.student.id,
          studentNumber: "171101", // already given to student1
        }),
      (err) => {
        assert.strictEqual(err.code, "EXAM_CANDIDATE_DUPLICATE_NUMBER");
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );
  });

  await t.test("TC.5 — Re-assigning same student to another number updates mapping safely", async () => {
    const updated = await candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
      studentId: ctx.student1.student.id,
      studentNumber: "171109",
    });
    assert.strictEqual(updated.studentNumber, "171109");

    const list = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].studentNumber, "171109");
  });

  await t.test("TC.6 — When exam results published, candidate mutation is locked (RESULTS_PUBLISHED_LOCKED)", async () => {
    // Publish exam
    await prisma.exam.update({
      where: { id: ctx.exam.id },
      data: { resultsPublishedAt: new Date() },
    });

    await assert.rejects(
      () =>
        candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
          studentId: ctx.student2.student.id,
          studentNumber: "171102",
        }),
      (err) => {
        assert.strictEqual(err.code, "RESULTS_PUBLISHED_LOCKED");
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );

    const list = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    await assert.rejects(
      () => candidateService.removeCandidate(ctx.teacherA.id, ctx.exam.id, list[0].id),
      (err) => {
        assert.strictEqual(err.code, "RESULTS_PUBLISHED_LOCKED");
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );

    // Restore unpublished for delete test
    await prisma.exam.update({
      where: { id: ctx.exam.id },
      data: { resultsPublishedAt: null },
    });
  });

  await t.test("TC.7 — Teacher can remove candidate when unpublished", async () => {
    const list = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    const delRes = await candidateService.removeCandidate(ctx.teacherA.id, ctx.exam.id, list[0].id);
    assert.strictEqual(delRes.success, true);

    const remaining = await candidateService.listExamCandidates(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(remaining.length, 0);
  });

  await t.test("TC.8 — Candidate removal deletes ONLY ExamCandidate mapping, preserving Student and Submission", async () => {
    // 1. Assign student1 to 171101
    const cand = await candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
      studentId: ctx.student1.student.id,
      studentNumber: "171101",
    });

    // 2. Create a dummy submission for 171101
    const sub = await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.code.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        resolvedStudentNumber: "171101",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_tc8`,
        originalImageSha256: `sha_${ctx.ts}_tc8`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 4,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("10.0000"),
      },
    });

    try {
      // 3. Delete candidate mapping
      const del = await candidateService.removeCandidate(ctx.teacherA.id, ctx.exam.id, cand.id);
      assert.strictEqual(del.success, true);

      // 4. Verify candidate mapping is deleted
      const foundCand = await prisma.examCandidate.findUnique({ where: { id: cand.id } });
      assert.strictEqual(foundCand, null);

      // 5. Verify Student is intact
      const foundStudent = await prisma.student.findUnique({ where: { id: ctx.student1.student.id } });
      assert.ok(foundStudent, "Student record must NOT be deleted");

      // 6. Verify Submission is intact
      const foundSub = await prisma.examSubmission.findUnique({ where: { id: sub.id } });
      assert.ok(foundSub, "ExamSubmission must NOT be deleted");
    } finally {
      await prisma.examSubmission.delete({ where: { id: sub.id } });
    }
  });

  await t.test("TC.9 — Candidate assignment/removal blocked on ARCHIVED exam (EXAM_ARCHIVED)", async () => {
    // Re-assign candidate for testing
    const cand = await candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
      studentId: ctx.student1.student.id,
      studentNumber: "171101",
    });

    // Set exam status to ARCHIVED
    await prisma.exam.update({
      where: { id: ctx.exam.id },
      data: { status: "ARCHIVED" },
    });

    try {
      // Attempting to assign in ARCHIVED exam throws EXAM_ARCHIVED (400)
      await assert.rejects(
        () =>
          candidateService.assignCandidate(ctx.teacherA.id, ctx.exam.id, {
            studentId: ctx.student2.student.id,
            studentNumber: "171102",
          }),
        (err) => {
          assert.strictEqual(err.code, "EXAM_ARCHIVED");
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );

      // Attempting to remove in ARCHIVED exam throws EXAM_ARCHIVED (400)
      await assert.rejects(
        () => candidateService.removeCandidate(ctx.teacherA.id, ctx.exam.id, cand.id),
        (err) => {
          assert.strictEqual(err.code, "EXAM_ARCHIVED");
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    } finally {
      // Restore status to CLOSED and cleanup candidate
      await prisma.exam.update({
        where: { id: ctx.exam.id },
        data: { status: "CLOSED" },
      });
      await candidateService.removeCandidate(ctx.teacherA.id, ctx.exam.id, cand.id);
    }
  });
});
