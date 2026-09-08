import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import * as examService from "../src/services/exam.service.js";
import { AppError } from "../src/middlewares/error.middleware.js";

// Setup helper to create or retrieve test teacher, subject, and class
async function getTestFixtures() {
  let teacherUser = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });

  if (!teacherUser || !teacherUser.teacher) {
    throw new Error("Cannot find test teacher with profile");
  }

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  return {
    teacherUser: { id: teacherUser.id, role: teacherUser.role },
    teacherId: teacherUser.teacher.id,
    subjectId: subject.id,
    classId: cls.id,
  };
}

test("Exam Lifecycle & Clone - Phase 5.4 Test Suite", async (t) => {
  const fixtures = await getTestFixtures();

  // Test 1: Clone DRAFT Exam
  await t.test("1. Clone DRAFT exam preserves codes and answers but NOT template", async () => {
    // Create source exam in DRAFT
    const sourceExam = await prisma.exam.create({
      data: {
        title: "Test Exam Source 1",
        description: "Source Description",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 4,
        maxScore: 10,
        scoringType: "CUSTOM",
        status: "DRAFT",
      },
    });

    // Add 2 ExamCodes
    const code1 = await prisma.examCode.create({
      data: { examId: sourceExam.id, code: "101" },
    });
    const code2 = await prisma.examCode.create({
      data: { examId: sourceExam.id, code: "102" },
    });

    // Add AnswerKeys with Decimal CUSTOM scores: 2.5, 2.5, 2.5, 2.5
    for (const code of [code1, code2]) {
      await prisma.answerKey.createMany({
        data: [
          { examCodeId: code.id, questionNumber: 1, correctAnswer: "A", score: 2.5 },
          { examCodeId: code.id, questionNumber: 2, correctAnswer: "B", score: 2.5 },
          { examCodeId: code.id, questionNumber: 3, correctAnswer: "C", score: 2.5 },
          { examCodeId: code.id, questionNumber: 4, correctAnswer: "D", score: 2.5 },
        ],
      });
    }

    // Add a dummy template to source exam
    await prisma.answerSheetTemplate.create({
      data: {
        examId: sourceExam.id,
        version: 1,
        layoutJson: { test: true },
      },
    });

    // Perform clone
    const cloned = await examService.cloneExam(sourceExam.id, fixtures.teacherUser);

    // Verify cloned exam properties
    assert.notEqual(cloned.id, sourceExam.id, "Cloned ID must be distinct");
    assert.equal(cloned.status, "DRAFT", "Cloned exam status must always be DRAFT");
    assert.equal(cloned.title, "Test Exam Source 1 - Bản sao", "Title must append - Bản sao");
    assert.equal(cloned.description, sourceExam.description);
    assert.equal(cloned.questionCount, 4);
    assert.equal(Number(cloned.maxScore), 10);
    assert.equal(cloned.scoringType, "CUSTOM");
    assert.equal(cloned.publishedAt, null);

    // Verify AnswerSheetTemplate is NOT cloned
    const clonedTemplates = await prisma.answerSheetTemplate.findMany({
      where: { examId: cloned.id },
    });
    assert.equal(clonedTemplates.length, 0, "Cloned exam must NOT have any AnswerSheetTemplate");

    // Verify ExamCodes are cloned with new IDs
    const clonedCodes = await prisma.examCode.findMany({
      where: { examId: cloned.id },
      include: { answerKeys: { orderBy: { questionNumber: "asc" } } },
      orderBy: { code: "asc" },
    });
    assert.equal(clonedCodes.length, 2, "Cloned exam must have 2 codes");
    assert.equal(clonedCodes[0].code, "101");
    assert.equal(clonedCodes[1].code, "102");
    assert.notEqual(clonedCodes[0].id, code1.id);
    assert.notEqual(clonedCodes[1].id, code2.id);

    // Verify Decimal AnswerKeys are copied exactly
    assert.equal(clonedCodes[0].answerKeys.length, 4);
    assert.equal(clonedCodes[0].answerKeys[0].correctAnswer, "A");
    assert.equal(Number(clonedCodes[0].answerKeys[0].score), 2.5);
    assert.equal(clonedCodes[0].answerKeys[1].correctAnswer, "B");
    assert.equal(Number(clonedCodes[0].answerKeys[1].score), 2.5);

    // Verify source exam remains unchanged
    const sourceAfter = await prisma.exam.findUnique({
      where: { id: sourceExam.id },
      include: { examCodes: true, answerSheetTemplates: true },
    });
    assert.equal(sourceAfter.status, "DRAFT");
    assert.equal(sourceAfter.examCodes.length, 2);
    assert.equal(sourceAfter.answerSheetTemplates.length, 1);

    // Clean up
    await prisma.exam.delete({ where: { id: cloned.id } });
    await prisma.exam.delete({ where: { id: sourceExam.id } });
  });

  // Test 2: Clone PUBLISHED Exam produces a DRAFT clone
  await t.test("2. Clone PUBLISHED exam produces a DRAFT clone", async () => {
    const publishedExam = await prisma.exam.create({
      data: {
        title: "Published Exam to Clone",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 2,
        maxScore: 10,
        scoringType: "EQUAL",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    const code = await prisma.examCode.create({
      data: { examId: publishedExam.id, code: "201" },
    });
    await prisma.answerKey.createMany({
      data: [
        { examCodeId: code.id, questionNumber: 1, correctAnswer: "A", score: 5.0 },
        { examCodeId: code.id, questionNumber: 2, correctAnswer: "B", score: 5.0 },
      ],
    });

    const cloned = await examService.cloneExam(publishedExam.id, fixtures.teacherUser);
    assert.equal(cloned.status, "DRAFT", "Clone of PUBLISHED exam must be DRAFT");
    assert.equal(cloned.title, "Published Exam to Clone - Bản sao");

    // Clean up
    await prisma.exam.delete({ where: { id: cloned.id } });
    // Hard delete directly in prisma for test cleanup
    await prisma.exam.delete({ where: { id: publishedExam.id } });
  });

  // Test 3: Hard Delete rules
  await t.test("3. Hard delete is allowed only for DRAFT; rejected for PUBLISHED, CLOSED, ARCHIVED", async () => {
    // 3a. DRAFT can be deleted via service
    const draftExam = await prisma.exam.create({
      data: {
        title: "Draft to Delete",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 1,
        maxScore: 10,
        status: "DRAFT",
      },
    });
    await examService.deleteExam(draftExam.id, fixtures.teacherUser);
    const deletedCheck = await prisma.exam.findUnique({ where: { id: draftExam.id } });
    assert.equal(deletedCheck, null, "DRAFT exam must be deleted");

    // 3b. PUBLISHED delete must be rejected with EXAM_DELETE_NOT_ALLOWED
    const publishedExam = await prisma.exam.create({
      data: {
        title: "Published Not Deletable",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 1,
        maxScore: 10,
        status: "PUBLISHED",
      },
    });
    await assert.rejects(
      async () => {
        await examService.deleteExam(publishedExam.id, fixtures.teacherUser);
      },
      (err) => {
        assert.equal(err.code, "EXAM_DELETE_NOT_ALLOWED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // 3c. CLOSED delete must be rejected with EXAM_DELETE_NOT_ALLOWED
    const closedExam = await prisma.exam.create({
      data: {
        title: "Closed Not Deletable",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 1,
        maxScore: 10,
        status: "CLOSED",
      },
    });
    await assert.rejects(
      async () => {
        await examService.deleteExam(closedExam.id, fixtures.teacherUser);
      },
      (err) => {
        assert.equal(err.code, "EXAM_DELETE_NOT_ALLOWED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // 3d. ARCHIVED delete must be rejected with EXAM_DELETE_NOT_ALLOWED
    const archivedExam = await prisma.exam.create({
      data: {
        title: "Archived Not Deletable",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 1,
        maxScore: 10,
        status: "ARCHIVED",
      },
    });
    await assert.rejects(
      async () => {
        await examService.deleteExam(archivedExam.id, fixtures.teacherUser);
      },
      (err) => {
        assert.equal(err.code, "EXAM_DELETE_NOT_ALLOWED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // Clean up test records
    await prisma.exam.delete({ where: { id: publishedExam.id } });
    await prisma.exam.delete({ where: { id: closedExam.id } });
    await prisma.exam.delete({ where: { id: archivedExam.id } });
  });

  // Test 4: Safe Metadata Editing & Field-Level Locking
  await t.test("4. Safe metadata editing allows title/desc on PUBLISHED, locks grading fields", async () => {
    const publishedExam = await prisma.exam.create({
      data: {
        title: "Original Published Title",
        description: "Original Desc",
        teacherId: fixtures.teacherId,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 10,
        maxScore: 10,
        scoringType: "EQUAL",
        status: "PUBLISHED",
      },
    });

    // 4a. Updating title and description should SUCCEED
    const updated = await examService.updateExam(
      publishedExam.id,
      {
        title: "Updated Title After Published",
        description: "Updated Description",
      },
      fixtures.teacherUser
    );
    assert.equal(updated.title, "Updated Title After Published");
    assert.equal(updated.description, "Updated Description");

    // 4b. Updating questionCount must be REJECTED with EXAM_FIELD_LOCKED
    await assert.rejects(
      async () => {
        await examService.updateExam(
          publishedExam.id,
          { questionCount: 20 },
          fixtures.teacherUser
        );
      },
      (err) => {
        assert.equal(err.code, "EXAM_FIELD_LOCKED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // 4c. Updating maxScore must be REJECTED with EXAM_FIELD_LOCKED
    await assert.rejects(
      async () => {
        await examService.updateExam(
          publishedExam.id,
          { maxScore: 20 },
          fixtures.teacherUser
        );
      },
      (err) => {
        assert.equal(err.code, "EXAM_FIELD_LOCKED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // 4d. Updating scoringType must be REJECTED with EXAM_FIELD_LOCKED
    await assert.rejects(
      async () => {
        await examService.updateExam(
          publishedExam.id,
          { scoringType: "CUSTOM" },
          fixtures.teacherUser
        );
      },
      (err) => {
        assert.equal(err.code, "EXAM_FIELD_LOCKED");
        assert.equal(err.statusCode, 409);
        return true;
      }
    );

    // 4e. Updating subjectId or classId must be REJECTED with EXAM_FIELD_LOCKED
    await assert.rejects(
      async () => {
        await examService.updateExam(
          publishedExam.id,
          { subjectId: "some-other-id" },
          fixtures.teacherUser
        );
      },
      (err) => {
        assert.equal(err.code, "EXAM_FIELD_LOCKED");
        return true;
      }
    );

    // Clean up
    await prisma.exam.delete({ where: { id: publishedExam.id } });
  });

  // Test 5: Authorization & Access Control
  await t.test("5. Authorization: Teacher cannot clone or edit another teacher's exam", async () => {
    // Create another teacher
    const otherUser = await prisma.user.create({
      data: {
        email: `other-teacher-${Date.now()}@school.edu.vn`,
        passwordHash: "hash",
        role: "TEACHER",
      },
    });
    const otherTeacher = await prisma.teacher.create({
      data: {
        userId: otherUser.id,
        teacherCode: `TC_${Date.now()}`,
        fullName: "Other Teacher",
      },
    });

    const otherExam = await prisma.exam.create({
      data: {
        title: "Other Teacher's Exam",
        teacherId: otherTeacher.id,
        subjectId: fixtures.subjectId,
        classId: fixtures.classId,
        questionCount: 5,
        maxScore: 10,
        status: "DRAFT",
      },
    });

    // Test teacher attempting to clone other teacher's exam must receive 403 EXAM_ACCESS_DENIED
    await assert.rejects(
      async () => {
        await examService.cloneExam(otherExam.id, fixtures.teacherUser);
      },
      (err) => {
        assert.equal(err.code, "EXAM_ACCESS_DENIED");
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    // Clean up
    await prisma.exam.delete({ where: { id: otherExam.id } });
    await prisma.teacher.delete({ where: { id: otherTeacher.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});
