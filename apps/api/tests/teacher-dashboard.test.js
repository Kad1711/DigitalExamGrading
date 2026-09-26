import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import {
  getTeacherDashboard,
  getTeacherClassStatistics,
} from "../src/services/teacher-dashboard.service.js";

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

  await t.test("TD.4 — getTeacherClassStatistics only includes teacher's subject and created exams (excludes other subjects)", async () => {
    const ts2 = Date.now() + 10;
    // Create Subject A (Informatics) and Subject B (Math)
    const subjA = await prisma.subject.create({
      data: { name: `Subj_Info_${ts2}`, code: `INF_${ts2.toString().slice(-4)}` },
    });
    const subjB = await prisma.subject.create({
      data: { name: `Subj_Math_${ts2}`, code: `MTH_${ts2.toString().slice(-4)}` },
    });

    const testClass = cls;

    // Teacher A teaches Subject A (Informatics) in Class 9X
    const teacherA = await prisma.user.create({
      data: {
        email: `teacher_a_${ts2}@digitalexam.local`,
        passwordHash: "dummy",
        role: "TEACHER",
        teacher: {
          create: {
            teacherCode: `TCA_${ts2.toString().slice(-6)}`,
            fullName: "Teacher A (Informatics)",
            primarySubjectId: subjA.id,
          },
        },
      },
      include: { teacher: true },
    });

    await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherA.teacher.id,
        classId: testClass.id,
        subjectId: subjA.id,
        academicYearId: testClass.academicYearId,
      },
    });

    // Teacher B teaches Subject B (Math) in Class 9X
    const teacherB = await prisma.user.create({
      data: {
        email: `teacher_b_${ts2}@digitalexam.local`,
        passwordHash: "dummy",
        role: "TEACHER",
        teacher: {
          create: {
            teacherCode: `TCB_${ts2.toString().slice(-6)}`,
            fullName: "Teacher B (Math)",
            primarySubjectId: subjB.id,
          },
        },
      },
      include: { teacher: true },
    });

    // Exam 1: Created by Teacher A for Subject A (Informatics) in Class 9X
    const examA = await prisma.exam.create({
      data: {
        title: `Exam Informatics ${ts2}`,
        teacherId: teacherA.teacher.id,
        subjectId: subjA.id,
        classId: testClass.id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "PUBLISHED",
      },
    });

    // Exam 2: Created by Teacher B for Subject B (Math) in Class 9X
    const examB = await prisma.exam.create({
      data: {
        title: `Exam Math ${ts2}`,
        teacherId: teacherB.teacher.id,
        subjectId: subjB.id,
        classId: testClass.id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "PUBLISHED",
      },
    });

    // Query statistics for Teacher A
    const statsA = await getTeacherClassStatistics(teacherA.id);

    // Teacher A must ONLY see Exam A (Informatics), NOT Exam B (Math)
    assert.strictEqual(statsA.stats.totalExams, 1, "Teacher A must only have 1 exam in stats");
    assert.strictEqual(statsA.exams.length, 1, "Teacher A must only see 1 exam in list");
    assert.strictEqual(statsA.exams[0].id, examA.id, "Exam must be Informatics exam");
    const hasMathExam = statsA.exams.some((e) => e.id === examB.id);
    assert.strictEqual(hasMathExam, false, "Math exam must NOT leak into Informatics teacher stats");
  });
});
