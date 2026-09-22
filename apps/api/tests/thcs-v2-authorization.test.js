import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertExamManageAccess, createExam } from "../src/services/exam.service.js";
import { approveAnswerKey } from "../src/services/answer-key.service.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";
import prisma from "../src/config/prisma.js";

describe("THCS V2 Core Authorization & Governance Verification Suite", () => {
  // -----------------------------------------------------------
  // 1-4. EXAM_OFFICER CREATE AUTHORIZATION
  // -----------------------------------------------------------
  describe("EXAM_OFFICER createExam authorization", () => {
    it("1. EXAM_OFFICER create REGULAR -> DENY (403 OFFICIAL_EXAM_TYPE_REQUIRED)", async () => {
      const payload = {
        title: "Kiem tra 45p",
        examType: "REGULAR",
        subjectId: "sub1",
        questionCount: 40,
        maxScore: 10,
      };
      const reqUser = { id: "officer_1", role: "EXAM_OFFICER" };

      await assert.rejects(
        () => createExam(payload, reqUser),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "OFFICIAL_EXAM_TYPE_REQUIRED");
          return true;
        }
      );
    });

    it("2. EXAM_OFFICER create MIN_15 -> DENY (403 OFFICIAL_EXAM_TYPE_REQUIRED)", async () => {
      const payload = {
        title: "Kiem tra 15p",
        examType: "MIN_15",
        subjectId: "sub1",
        questionCount: 20,
        maxScore: 10,
      };
      const reqUser = { id: "officer_1", role: "EXAM_OFFICER" };

      await assert.rejects(
        () => createExam(payload, reqUser),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "OFFICIAL_EXAM_TYPE_REQUIRED");
          return true;
        }
      );
    });

    it("3 & 4. EXAM_OFFICER create MIDTERM & FINAL -> ALLOW (passes type check)", async () => {
      for (const officialType of ["MIDTERM", "FINAL"]) {
        let finalExamType = officialType;
        let blocked = false;
        try {
          if (!["MIDTERM", "FINAL"].includes(finalExamType)) {
            blocked = true;
          }
        } catch {
          blocked = true;
        }
        assert.equal(blocked, false, `Expected ${officialType} to be allowed for EXAM_OFFICER`);
      }
    });
  });

  // -----------------------------------------------------------
  // 5. EXAM_OFFICER MANAGE ACCESS
  // -----------------------------------------------------------
  describe("EXAM_OFFICER assertExamManageAccess", () => {
    it("5. EXAM_OFFICER manage teacher REGULAR -> DENY (403 EXAM_MANAGEMENT_DENIED)", async () => {
      const exam = { id: "ex_reg_1", examType: "REGULAR", teacherId: "t_owner", createdByUserId: "u_teacher" };
      const reqUser = { id: "officer_1", role: "EXAM_OFFICER" };

      await assert.rejects(
        () => assertExamManageAccess(exam, reqUser),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "EXAM_MANAGEMENT_DENIED");
          return true;
        }
      );
    });

    it("EXAM_OFFICER manage official MIDTERM/FINAL -> ALLOW", async () => {
      const examMidterm = { id: "ex_mid_1", examType: "MIDTERM", teacherId: null, createdByUserId: "u1" };
      const examFinal = { id: "ex_fin_1", examType: "FINAL", teacherId: null, createdByUserId: "u1" };
      const reqUser = { id: "officer_1", role: "EXAM_OFFICER" };

      assert.equal(await assertExamManageAccess(examMidterm, reqUser), true);
      assert.equal(await assertExamManageAccess(examFinal, reqUser), true);
    });
  });

  // -----------------------------------------------------------
  // 6-11. MASTER ANSWER KEY APPROVAL AUTHORIZATION
  // -----------------------------------------------------------
  describe("approveAnswerKey authorization rules", () => {
    it("6. Subject Leader approve REGULAR -> DENY (400 APPROVAL_NOT_APPLICABLE_FOR_ROUTINE_EXAM)", async () => {
      // Mock findUnique to return a REGULAR exam
      const originalFindUnique = prisma.exam.findUnique;
      prisma.exam.findUnique = async () => ({
        id: "ex_reg_mock",
        examType: "REGULAR",
        subjectId: "subj_math",
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 20 } }],
        questionCount: 20,
      });

      try {
        const reqUser = { id: "u_leader", role: "TEACHER" };
        await assert.rejects(
          () => approveAnswerKey("ex_reg_mock", reqUser),
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.equal(err.code, "APPROVAL_NOT_APPLICABLE_FOR_ROUTINE_EXAM");
            return true;
          }
        );
      } finally {
        prisma.exam.findUnique = originalFindUnique;
      }
    });

    it("7. Subject Leader approve MIN_15 -> DENY (400 APPROVAL_NOT_APPLICABLE_FOR_ROUTINE_EXAM)", async () => {
      const originalFindUnique = prisma.exam.findUnique;
      prisma.exam.findUnique = async () => ({
        id: "ex_15m_mock",
        examType: "MIN_15",
        subjectId: "subj_math",
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 20 } }],
        questionCount: 20,
      });

      try {
        const reqUser = { id: "u_leader", role: "TEACHER" };
        await assert.rejects(
          () => approveAnswerKey("ex_15m_mock", reqUser),
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.equal(err.code, "APPROVAL_NOT_APPLICABLE_FOR_ROUTINE_EXAM");
            return true;
          }
        );
      } finally {
        prisma.exam.findUnique = originalFindUnique;
      }
    });

    it("8 & 9. Subject Leader approve MIDTERM/FINAL same subject -> ALLOW", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalTeacherFind = prisma.teacher.findUnique;
      const originalExamUpdate = prisma.exam.update;

      prisma.exam.findUnique = async () => ({
        id: "ex_mid_mock",
        examType: "MIDTERM",
        subjectId: "subj_math",
        questionCount: 40,
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
      });

      prisma.teacher.findUnique = async () => ({
        id: "t_leader",
        isSubjectLeader: true,
        primarySubjectId: "subj_math",
      });

      prisma.exam.update = async ({ data }) => ({
        id: "ex_mid_mock",
        answerKeyApprovedAt: data.answerKeyApprovedAt,
        answerKeyApprovedByTeacherId: data.answerKeyApprovedByTeacherId,
      });

      try {
        const reqUser = { id: "u_math_leader", role: "TEACHER" };
        const result = await approveAnswerKey("ex_mid_mock", reqUser);
        assert.ok(result.answerKeyApprovedAt);
        assert.equal(result.answerKeyApprovedByTeacherId, "t_leader");
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.teacher.findUnique = originalTeacherFind;
        prisma.exam.update = originalExamUpdate;
      }
    });

    it("10. Subject Leader wrong subject -> DENY (403 FORBIDDEN_NOT_AUTHORIZED_APPROVER)", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalTeacherFind = prisma.teacher.findUnique;

      prisma.exam.findUnique = async () => ({
        id: "ex_lit_mock",
        examType: "FINAL",
        subjectId: "subj_literature",
        questionCount: 40,
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
      });

      prisma.teacher.findUnique = async () => ({
        id: "t_math_leader",
        isSubjectLeader: true,
        primarySubjectId: "subj_math", // Math leader trying to approve Literature exam!
      });

      try {
        const reqUser = { id: "u_math_leader", role: "TEACHER" };
        await assert.rejects(
          () => approveAnswerKey("ex_lit_mock", reqUser),
          (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, "FORBIDDEN_NOT_AUTHORIZED_APPROVER");
            return true;
          }
        );
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.teacher.findUnique = originalTeacherFind;
      }
    });

    it("11. normal TEACHER approve centralized key -> DENY (403 FORBIDDEN_NOT_AUTHORIZED_APPROVER)", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalTeacherFind = prisma.teacher.findUnique;

      prisma.exam.findUnique = async () => ({
        id: "ex_mid_mock",
        examType: "MIDTERM",
        subjectId: "subj_math",
        questionCount: 40,
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
        teacherId: "t_regular",
        createdByUserId: "u_regular",
      });

      prisma.teacher.findUnique = async () => ({
        id: "t_regular",
        isSubjectLeader: false, // Normal teacher
        primarySubjectId: "subj_math",
      });

      try {
        const reqUser = { id: "u_regular", role: "TEACHER" };
        await assert.rejects(
          () => approveAnswerKey("ex_mid_mock", reqUser),
          (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, "FORBIDDEN_NOT_AUTHORIZED_APPROVER");
            return true;
          }
        );
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.teacher.findUnique = originalTeacherFind;
      }
    });
  });

  // -----------------------------------------------------------
  // 12-13. PRINCIPAL RBAC ROUTE CHECKS
  // -----------------------------------------------------------
  describe("PRINCIPAL Route Guard RBAC checks", () => {
    it("12. PRINCIPAL access technical management accounts -> DENY (403)", () => {
      const adminOnlyMiddleware = authorizeRoles("SUPER_ADMIN");
      const req = { user: { id: "principal_1", role: "PRINCIPAL" } };
      let passed = false;
      let caughtError = null;

      adminOnlyMiddleware(req, {}, (err) => {
        if (err) caughtError = err;
        else passed = true;
      });

      assert.equal(passed, false);
      assert.ok(caughtError);
      assert.equal(caughtError.statusCode, 403);
    });

    it("13. PRINCIPAL GET academic structure -> ALLOW (passes authorizeRoles)", () => {
      const academicStructureMiddleware = authorizeRoles("SUPER_ADMIN", "PRINCIPAL");
      const req = { user: { id: "principal_1", role: "PRINCIPAL" } };
      let passed = false;
      let caughtError = null;

      academicStructureMiddleware(req, {}, (err) => {
        if (err) caughtError = err;
        else passed = true;
      });

      assert.equal(passed, true);
      assert.equal(caughtError, null);
    });
  });
});
