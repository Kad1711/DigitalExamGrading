import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { getExamAnalytics } from "../src/services/exam-analytics.service.js";
import { getTeacherDashboard } from "../src/services/teacher-dashboard.service.js";
import { listExamCandidates } from "../src/services/exam-candidate.service.js";
import { listStudentResults } from "../src/services/student-result.service.js";

test("Phase 10 — V1 Final RBAC Security Matrix Suite", async (t) => {
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const teacherUser = await prisma.user.findFirst({ where: { role: "TEACHER" }, include: { teacher: true } });
  const studentUser = await prisma.user.findFirst({ where: { role: "STUDENT" }, include: { student: true } });

  const teacherExam = await prisma.exam.findFirst({
    where: { teacherId: teacherUser.teacher.id },
  });

  await t.test("TR.1 — Admin cannot access Teacher Exam Analytics (EXAM_ACCESS_DENIED)", async () => {
    if (teacherExam) {
      await assert.rejects(
        () => getExamAnalytics(adminUser.id, teacherExam.id),
        (err) => {
          assert.strictEqual(err.code, "EXAM_ACCESS_DENIED");
          return true;
        }
      );
    }
  });

  await t.test("TR.2 — Admin cannot access Teacher Candidate Management", async () => {
    if (teacherExam) {
      await assert.rejects(
        () => listExamCandidates(adminUser.id, teacherExam.id),
        (err) => {
          assert.strictEqual(err.code, "EXAM_ACCESS_DENIED");
          return true;
        }
      );
    }
  });

  await t.test("TR.3 — Admin cannot access Teacher Dashboard (TEACHER_NOT_FOUND)", async () => {
    await assert.rejects(
      () => getTeacherDashboard(adminUser.id),
      (err) => {
        assert.strictEqual(err.code, "TEACHER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("TR.4 — Teacher cannot access Student Portal as Student (STUDENT_PROFILE_NOT_FOUND)", async () => {
    await assert.rejects(
      () => listStudentResults(teacherUser.id),
      (err) => {
        assert.strictEqual(err.code, "STUDENT_PROFILE_NOT_FOUND");
        return true;
      }
    );
  });
});
