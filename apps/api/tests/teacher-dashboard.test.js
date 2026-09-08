import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import { getTeacherDashboard } from "../src/services/teacher-dashboard.service.js";

test("Phase 10 — Teacher Dashboard Suite", async (t) => {
  const ts = Date.now();

  const teacher = await prisma.user.create({
    data: {
      email: `dash_t_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `DSH_${ts.toString().slice(-6)}`,
          fullName: "Dashboard Teacher",
        },
      },
    },
    include: { teacher: true },
  });

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  // Create an active PUBLISHED exam with 1 provisional submission
  const examActive = await prisma.exam.create({
    data: {
      title: `Active Exam ${ts}`,
      teacherId: teacher.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "PUBLISHED",
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: examActive.id, code: "001" },
  });
  const template = await prisma.answerSheetTemplate.create({
    data: { examId: examActive.id, layoutJson: {} },
  });

  await prisma.examSubmission.create({
    data: {
      examId: examActive.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacher.id,
      status: "PROVISIONAL",
      resolvedStudentNumber: "171199",
      studentNumberOmrStatus: "CONFIRMED",
      originalImageStorageKey: `img_dash_${ts}`,
      originalImageSha256: `sha_dash_${ts}`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 100,
      omrOverallStatus: "UNCERTAIN",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 0,
      incorrectCount: 0,
      blankCount: 0,
      unresolvedCount: 4,
    },
  });

  await t.test("TD.1 — getTeacherDashboard returns accurate summary", async () => {
    const dash = await getTeacherDashboard(teacher.id);
    assert.strictEqual(dash.summary.totalExams >= 1, true);
    assert.strictEqual(dash.summary.activeExams >= 1, true);
    assert.strictEqual(dash.summary.totalSubmissions >= 1, true);
    assert.strictEqual(dash.summary.totalProvisionalSubmissions >= 1, true);
  });

  await t.test("TD.2 — Action-needed list contains pending review item", async () => {
    const dash = await getTeacherDashboard(teacher.id);
    const pending = dash.actionNeeded.find((a) => a.type === "PENDING_REVIEW" && a.examId === examActive.id);
    assert.ok(pending);
    assert.strictEqual(pending.count, 1);
  });

  await t.test("TD.3 — Recent exams list includes recently created exam", async () => {
    const dash = await getTeacherDashboard(teacher.id);
    assert.ok(Array.isArray(dash.recentExams));
    const found = dash.recentExams.find((e) => e.id === examActive.id);
    assert.ok(found);
    assert.strictEqual(found.title, `Active Exam ${ts}`);
  });
});
