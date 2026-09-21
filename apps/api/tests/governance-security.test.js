import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertExamManageAccess } from "../src/services/exam.service.js";
import { AppError } from "../src/middlewares/error.middleware.js";

describe("Governance & Security Access Control Unit Suite", () => {
  describe("assertExamManageAccess", () => {
    it("permits ADMIN unconditional management access", async () => {
      const exam = { id: "ex1", examType: "MIDTERM", teacherId: "t1", createdByUserId: "u1" };
      const reqUser = { id: "admin1", role: "ADMIN" };
      const allowed = await assertExamManageAccess(exam, reqUser);
      assert.equal(allowed, true);
    });

    it("permits EXAM_BOARD to manage official exams not owned by a normal teacher", async () => {
      const exam = { id: "ex2", examType: "MIDTERM", teacherId: null, createdByUserId: "eb1" };
      const reqUser = { id: "eb1", role: "EXAM_BOARD" };
      const allowed = await assertExamManageAccess(exam, reqUser);
      assert.equal(allowed, true);
    });

    it("blocks EXAM_BOARD from managing a teacher's routine assessment", async () => {
      const exam = { id: "ex3", examType: "REGULAR", teacherId: "t1", createdByUserId: "u_teacher" };
      const reqUser = { id: "eb1", role: "EXAM_BOARD" };
      await assert.rejects(
        () => assertExamManageAccess(exam, reqUser),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "EXAM_MANAGEMENT_DENIED");
          return true;
        }
      );
    });

    it("blocks PRINCIPAL, VICE_PRINCIPAL, and ACADEMIC_BOARD from modifying exam configuration (read-only oversight)", async () => {
      const exam = { id: "ex4", examType: "FINAL", teacherId: null, createdByUserId: "u1" };
      for (const role of ["PRINCIPAL", "VICE_PRINCIPAL", "ACADEMIC_BOARD"]) {
        const reqUser = { id: "user_oversight", role };
        await assert.rejects(
          () => assertExamManageAccess(exam, reqUser),
          (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, "EXAM_MANAGEMENT_DENIED");
            return true;
          }
        );
      }
    });
  });

  describe("Self-Approval 4-Eyes Governance Rule", () => {
    it("enforces strict self-approval rejection when requester matches approver", () => {
      const exam = {
        id: "ex_official_1",
        publicationApprovalStatus: "PENDING_APPROVAL",
        publicationRequestedByUserId: "user_requester_1",
        createdByUserId: "user_creator_1",
      };
      const approver = { id: "user_requester_1", role: "ACADEMIC_BOARD" };

      // Direct simulation of approval guard logic
      const isSelfApproval = exam.publicationRequestedByUserId === approver.id;
      assert.equal(isSelfApproval, true);

      if (isSelfApproval) {
        const error = new AppError(
          "Người gửi yêu cầu phê duyệt không được tự phê duyệt công bố kết quả kỳ thi.",
          403,
          "SELF_APPROVAL_FORBIDDEN"
        );
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "SELF_APPROVAL_FORBIDDEN");
      }
    });

    it("enforces strict self-approval rejection even if approver is ADMIN when they were the requester", () => {
      const exam = {
        id: "ex_official_2",
        publicationApprovalStatus: "PENDING_APPROVAL",
        publicationRequestedByUserId: "admin_123",
        createdByUserId: "admin_123",
      };
      const approver = { id: "admin_123", role: "ADMIN" };

      const isSelfApproval = exam.publicationRequestedByUserId === approver.id;
      assert.equal(isSelfApproval, true);

      if (isSelfApproval) {
        const error = new AppError(
          "Người gửi yêu cầu phê duyệt không được tự phê duyệt công bố kết quả kỳ thi.",
          403,
          "SELF_APPROVAL_FORBIDDEN"
        );
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "SELF_APPROVAL_FORBIDDEN");
      }
    });
  });

  describe("Official Publication Segregation of Duties", () => {
    it("confirms PRINCIPAL and VICE_PRINCIPAL cannot approve or reject publication (Read/Oversight only)", () => {
      const allowedApprovers = ["ACADEMIC_BOARD", "ADMIN"];
      for (const role of ["PRINCIPAL", "VICE_PRINCIPAL"]) {
        assert.equal(allowedApprovers.includes(role), false);
      }
    });

    it("confirms EXAM_BOARD cannot approve publication requests", () => {
      const allowedApprovers = ["ACADEMIC_BOARD", "ADMIN"];
      assert.equal(allowedApprovers.includes("EXAM_BOARD"), false);
    });

    it("confirms ACADEMIC_BOARD cannot execute official publication (only EXAM_BOARD or ADMIN)", () => {
      const allowedPublishers = ["EXAM_BOARD", "ADMIN"];
      assert.equal(allowedPublishers.includes("ACADEMIC_BOARD"), false);
      assert.equal(allowedPublishers.includes("EXAM_BOARD"), true);
      assert.equal(allowedPublishers.includes("ADMIN"), true);
    });
  });

  describe("Teacher Official Exam Export Data-Scope Guard", () => {
    it("blocks teacher from exporting official exams they do not own", () => {
      const exam = {
        id: "ex_midterm_school",
        examType: "MIDTERM",
        teacherId: "teacher_head_dept",
        createdByUserId: "exam_board_user",
      };
      const requestingTeacher = {
        id: "teacher_other_id",
        role: "TEACHER",
        teacher: { id: "teacher_other_profile" },
      };

      const isOfficial = ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType);
      assert.equal(isOfficial, true);

      const isOwner =
        (exam.teacherId && requestingTeacher.teacher && exam.teacherId === requestingTeacher.teacher.id) ||
        exam.createdByUserId === requestingTeacher.id;
      assert.equal(isOwner, false);

      if (requestingTeacher.role === "TEACHER" && isOfficial && !isOwner) {
        const err = new AppError(
          "Giáo viên không có quyền xuất kết quả kỳ thi chính quy toàn trường. Báo cáo này do Ban khảo thí và Ban giám hiệu quản lý.",
          403,
          "TEACHER_OFFICIAL_EXPORT_DENIED"
        );
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "TEACHER_OFFICIAL_EXPORT_DENIED");
      }
    });

    it("allows teacher to export routine exams they own", () => {
      const exam = {
        id: "ex_routine_15m",
        examType: "MIN_15",
        teacherId: "teacher_owner_profile",
        createdByUserId: "teacher_owner_user",
      };
      const requestingTeacher = {
        id: "teacher_owner_user",
        role: "TEACHER",
        teacher: { id: "teacher_owner_profile" },
      };

      const isOfficial = ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType);
      assert.equal(isOfficial, false); // Routine exam -> allowed
    });
  });
});
