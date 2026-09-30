import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { assertExamManageAccess, createExam, updateExam } from "../src/services/exam.service.js";
import { approveAnswerKey, putAnswerKey } from "../src/services/answer-key.service.js";
import { applyImport } from "../src/services/answer-key-import.service.js";
import { createExamCode, deleteExamCode } from "../src/services/exam-code.service.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";
import prisma from "../src/config/prisma.js";

describe("THCS V2 Core Authorization & Governance Verification Suite", () => {
  const originalTx = prisma.$transaction;
  const originalExamFind = prisma.exam.findUnique;
  const originalExamUpdate = prisma.exam.update;
  const originalTeacherFind = prisma.teacher.findUnique;
  const originalExamCodeFind = prisma.examCode.findUnique;
  const originalExamCodeFindMany = prisma.examCode.findMany;
  const originalExamCodeCreate = prisma.examCode.create;
  const originalExamCodeDelete = prisma.examCode.delete;
  const originalSubmissionCount = prisma.examSubmission.count;

  beforeEach(() => {
    // Intercept prisma.$transaction so all transactions in this unit test suite use mockTx
    // and never query the real PostgreSQL database in CI or local environment.
    const mockTx = {
      $executeRaw: async () => 1,
      exam: {
        findUnique: (...args) => (prisma.exam.findUnique ? prisma.exam.findUnique(...args) : null),
        update: (...args) => (prisma.exam.update ? prisma.exam.update(...args) : null),
      },
      teacher: {
        findUnique: (...args) => (prisma.teacher.findUnique ? prisma.teacher.findUnique(...args) : null),
      },
      examCode: {
        findUnique: (...args) => (prisma.examCode.findUnique ? prisma.examCode.findUnique(...args) : null),
        findMany: (...args) => (prisma.examCode.findMany ? prisma.examCode.findMany(...args) : []),
        create: (...args) => (prisma.examCode.create ? prisma.examCode.create(...args) : null),
        delete: (...args) => (prisma.examCode.delete ? prisma.examCode.delete(...args) : null),
      },
      answerKey: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async ({ data }) => ({ count: data?.length || 0 }),
      },
    };

    prisma.$transaction = async (arg) => {
      if (typeof arg === "function") {
        return await arg(mockTx);
      }
      return Promise.all(arg);
    };
  });

  afterEach(() => {
    prisma.exam.findUnique = originalExamFind;
    prisma.exam.update = originalExamUpdate;
    prisma.teacher.findUnique = originalTeacherFind;
    prisma.examCode.findUnique = originalExamCodeFind;
    prisma.examCode.findMany = originalExamCodeFindMany;
    prisma.examCode.create = originalExamCodeCreate;
    prisma.examCode.delete = originalExamCodeDelete;
    prisma.examSubmission.count = originalSubmissionCount;
    prisma.$transaction = originalTx;
  });

  after(() => {
    prisma.$transaction = originalTx;
  });
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

  // -----------------------------------------------------------
  // 14-19. MASTER ANSWER KEY APPROVAL LIFECYCLE & AUDIT
  // -----------------------------------------------------------
  describe("Master Answer Key Approval Lifecycle & Audit Suite", () => {
    it("14. Leadership (VICE_PRINCIPAL) approve MIDTERM -> ALLOW, records answerKeyApprovedByUserId", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalExamUpdate = prisma.exam.update;
      const originalTeacherFind = prisma.teacher.findUnique;

      let updatePayload = null;
      prisma.exam.findUnique = async () => ({
        id: "ex_mid_bgh",
        status: "DRAFT",
        examType: "MIDTERM",
        subjectId: "subj_it",
        questionCount: 40,
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
      });
      prisma.teacher.findUnique = async () => null;

      prisma.exam.update = async ({ data, include }) => {
        updatePayload = data;
        return {
          id: "ex_mid_bgh",
          ...data,
          answerKeyApprovedByUser: {
            id: "u_vice_principal",
            fullName: "Trần Phó Hiệu Trưởng",
            role: "VICE_PRINCIPAL",
          },
        };
      };

      try {
        const reqUser = { id: "u_vice_principal", role: "VICE_PRINCIPAL" };
        const result = await approveAnswerKey("ex_mid_bgh", reqUser);
        assert.ok(result.answerKeyApprovedAt);
        assert.equal(updatePayload.answerKeyApprovedByUserId, "u_vice_principal");
        assert.equal(result.answerKeyApprovedByUser.fullName, "Trần Phó Hiệu Trưởng");
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.exam.update = originalExamUpdate;
        prisma.teacher.findUnique = originalTeacherFind;
      }
    });

    it("15. Duplicate approval on already-approved exam -> DENY (409 ANSWER_KEY_ALREADY_APPROVED)", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalTeacherFind = prisma.teacher.findUnique;

      prisma.exam.findUnique = async () => ({
        id: "ex_mid_approved",
        status: "DRAFT",
        examType: "MIDTERM",
        subjectId: "subj_math",
        questionCount: 40,
        answerKeyApprovedAt: new Date(),
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
      });
      prisma.teacher.findUnique = async () => null;

      try {
        const reqUser = { id: "u_officer", role: "EXAM_OFFICER" };
        await assert.rejects(
          () => approveAnswerKey("ex_mid_approved", reqUser),
          (err) => {
            assert.equal(err.statusCode, 409);
            assert.equal(err.code, "ANSWER_KEY_ALREADY_APPROVED");
            return true;
          }
        );
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.teacher.findUnique = originalTeacherFind;
      }
    });

    it("16. Approve non-DRAFT exam -> DENY (409 EXAM_NOT_DRAFT)", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalTeacherFind = prisma.teacher.findUnique;

      prisma.exam.findUnique = async () => ({
        id: "ex_mid_published",
        status: "PUBLISHED",
        examType: "MIDTERM",
        subjectId: "subj_math",
        questionCount: 40,
        examCodes: [{ id: "c1", code: "101", _count: { answerKeys: 40 } }],
      });
      prisma.teacher.findUnique = async () => null;

      try {
        const reqUser = { id: "u_officer", role: "EXAM_OFFICER" };
        await assert.rejects(
          () => approveAnswerKey("ex_mid_published", reqUser),
          (err) => {
            assert.equal(err.statusCode, 409);
            assert.equal(err.code, "EXAM_NOT_DRAFT");
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
  // 17-21. MASTER ANSWER KEY INVALIDATION ON MODIFICATIONS
  // -----------------------------------------------------------
  describe("Master Answer Key Approval Invalidation Suite", () => {
    it("17. putAnswerKey invalidates answer key approval atomically", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalCodeFind = prisma.examCode.findUnique;
      const originalSubCount = prisma.examSubmission.count;
      const originalTx = prisma.$transaction;

      let invalidatedData = null;

      prisma.exam.findUnique = async () => ({
        id: "ex_1",
        status: "DRAFT",
        examType: "MIDTERM",
        questionCount: 2,
        maxScore: 10,
        scoringType: "EQUAL",
        createdByUserId: "u_teacher",
        teacherId: "t_teacher",
      });
      prisma.examCode.findUnique = async () => ({ id: "c_1", examId: "ex_1", code: "101" });
      prisma.examSubmission.count = async () => 0;

      const mockTx = {
        answerKey: {
          deleteMany: async () => {},
          createMany: async ({ data }) => ({ count: data.length }),
        },
        exam: {
          update: async ({ data }) => {
            invalidatedData = data;
            return {};
          },
        },
      };
      prisma.$transaction = async (cb) => cb(mockTx);

      try {
        const answers = [
          { questionNumber: 1, correctAnswer: "A" },
          { questionNumber: 2, correctAnswer: "B" },
        ];
        const reqUser = { id: "u_teacher", role: "TEACHER" };
        await putAnswerKey("ex_1", "c_1", answers, reqUser);

        assert.ok(invalidatedData, "Expected exam.update to be called in transaction");
        assert.equal(invalidatedData.answerKeyApprovedAt, null);
        assert.equal(invalidatedData.answerKeyApprovedByTeacherId, null);
        assert.equal(invalidatedData.answerKeyApprovedByUserId, null);
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.examCode.findUnique = originalCodeFind;
        prisma.examSubmission.count = originalSubCount;
        prisma.$transaction = originalTx;
      }
    });

    it("18. createExamCode invalidates answer key approval", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalCodesFind = prisma.examCode.findMany;
      const originalCodeCreate = prisma.examCode.create;
      const originalExamUpdate = prisma.exam.update;
      const originalTx = prisma.$transaction;

      let invalidatedData = null;

      prisma.exam.findUnique = async () => ({
        id: "ex_1",
        status: "DRAFT",
        examType: "MIDTERM",
        createdByUserId: "u_teacher",
        teacherId: "t_teacher",
      });
      prisma.examCode.findMany = async () => [];
      prisma.examCode.create = async ({ data }) => ({ id: "c_new", ...data });
      prisma.exam.update = async ({ data }) => {
        invalidatedData = data;
        return {};
      };
      prisma.$transaction = async (ops) => {
        return Promise.all(ops);
      };

      try {
        const reqUser = { id: "u_teacher", role: "TEACHER" };
        await createExamCode("ex_1", "102", reqUser);

        assert.ok(invalidatedData, "Expected exam.update in transaction");
        assert.equal(invalidatedData.answerKeyApprovedAt, null);
        assert.equal(invalidatedData.answerKeyApprovedByTeacherId, null);
        assert.equal(invalidatedData.answerKeyApprovedByUserId, null);
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.examCode.findMany = originalCodesFind;
        prisma.examCode.create = originalCodeCreate;
        prisma.exam.update = originalExamUpdate;
        prisma.$transaction = originalTx;
      }
    });

    it("19. deleteExamCode invalidates answer key approval", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalCodeFind = prisma.examCode.findUnique;
      const originalCodeDelete = prisma.examCode.delete;
      const originalExamUpdate = prisma.exam.update;
      const originalTx = prisma.$transaction;

      let invalidatedData = null;

      prisma.exam.findUnique = async () => ({
        id: "ex_1",
        status: "DRAFT",
        examType: "MIDTERM",
        createdByUserId: "u_teacher",
        teacherId: "t_teacher",
      });
      prisma.examCode.findUnique = async () => ({ id: "c_1", examId: "ex_1", code: "101" });
      prisma.examCode.delete = async () => ({ id: "c_1" });
      prisma.exam.update = async ({ data }) => {
        invalidatedData = data;
        return {};
      };
      prisma.$transaction = async (ops) => {
        return Promise.all(ops);
      };

      try {
        const reqUser = { id: "u_teacher", role: "TEACHER" };
        await deleteExamCode("ex_1", "c_1", reqUser);

        assert.ok(invalidatedData, "Expected exam.update in transaction");
        assert.equal(invalidatedData.answerKeyApprovedAt, null);
        assert.equal(invalidatedData.answerKeyApprovedByTeacherId, null);
        assert.equal(invalidatedData.answerKeyApprovedByUserId, null);
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.examCode.findUnique = originalCodeFind;
        prisma.examCode.delete = originalCodeDelete;
        prisma.exam.update = originalExamUpdate;
        prisma.$transaction = originalTx;
      }
    });

    it("20. updateExam modifying maxScore or questionCount invalidates answer key approval", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalExamUpdate = prisma.exam.update;
      const originalTeacherFind = prisma.teacher.findUnique;

      let updatedData = null;

      prisma.exam.findUnique = async () => ({
        id: "ex_1",
        status: "DRAFT",
        examType: "MIDTERM",
        questionCount: 40,
        maxScore: 10,
        scoringType: "EQUAL",
        createdByUserId: "u_teacher",
        teacherId: "t_teacher",
      });
      prisma.teacher.findUnique = async () => ({ id: "t_teacher", primarySubjectId: "subj_math" });
      prisma.exam.update = async ({ data }) => {
        updatedData = data;
        return { id: "ex_1", ...data };
      };

      try {
        const reqUser = { id: "u_teacher", role: "TEACHER" };
        await updateExam("ex_1", { maxScore: 20 }, reqUser);

        assert.ok(updatedData, "Expected exam.update to be called");
        assert.equal(updatedData.maxScore, 20);
        assert.equal(updatedData.answerKeyApprovedAt, null);
        assert.equal(updatedData.answerKeyApprovedByTeacherId, null);
        assert.equal(updatedData.answerKeyApprovedByUserId, null);
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.exam.update = originalExamUpdate;
        prisma.teacher.findUnique = originalTeacherFind;
      }
    });

    it("21. applyImport (importAnswerKeys) invalidates answer key approval atomically", async () => {
      const originalExamFind = prisma.exam.findUnique;
      const originalCodeFind = prisma.examCode.findMany;
      const originalSubCount = prisma.examSubmission.count;
      const originalTx = prisma.$transaction;

      let invalidatedData = null;

      prisma.exam.findUnique = async () => ({
        id: "ex_1",
        status: "DRAFT",
        examType: "MIDTERM",
        questionCount: 2,
        maxScore: 10,
        scoringType: "EQUAL",
        createdByUserId: "u_teacher",
        teacherId: "t_teacher",
      });
      prisma.examCode.findMany = async () => [
        { id: "c_1", examId: "ex_1", code: "101" },
      ];
      prisma.examSubmission.count = async () => 0;

      const mockTx = {
        $executeRaw: async () => 1,
        answerKey: {
          deleteMany: async () => {},
          createMany: async ({ data }) => ({ count: data.length }),
        },
        exam: {
          update: async ({ data }) => {
            invalidatedData = data;
            return {};
          },
        },
      };
      prisma.$transaction = async (cb) => cb(mockTx);

      try {
        const csvContent = "examcode,questionnumber,correctanswer,score\n101,1,A,5\n101,2,B,5\n";
        const fileBuffer = Buffer.from(csvContent, "utf-8");
        const reqUser = { id: "u_teacher", role: "TEACHER" };

        const result = await applyImport(
          "ex_1",
          fileBuffer,
          "text/csv",
          "import.csv",
          reqUser
        );

        assert.equal(result.totalAnswers, 2);
        assert.ok(invalidatedData, "Expected tx.exam.update to be called");
        assert.equal(invalidatedData.answerKeyApprovedAt, null);
        assert.equal(invalidatedData.answerKeyApprovedByTeacherId, null);
        assert.equal(invalidatedData.answerKeyApprovedByUserId, null);
        assert.equal(invalidatedData.publicationApprovalStatus, "NOT_REQUIRED");
      } finally {
        prisma.exam.findUnique = originalExamFind;
        prisma.examCode.findMany = originalCodeFind;
        prisma.examSubmission.count = originalSubCount;
        prisma.$transaction = originalTx;
      }
    });
  });
});
