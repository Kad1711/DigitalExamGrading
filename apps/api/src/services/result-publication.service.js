import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, getTeacherProfile } from "./exam.service.js";

/**
 * Checks publication readiness for an exam.
 *
 * Requirements (Section 4 Complete Matrix):
 *  1. Exam must be CLOSED (DRAFT, PUBLISHED, ARCHIVED cannot publish)
 *  2. At least one submission exists (totalSubmissions > 0)
 *  3. At least one submission is FINAL (finalCount > 0)
 *  4. All submissions are FINAL (provisionalCount === 0)
 *  5. No submissions with identityNeedsReview = true (identityNeedsReviewCount === 0)
 *  6. Every submission has non-null resolvedStudentNumber (unresolvedSbdCount === 0)
 *  7. No duplicate confirmed SBDs (duplicateStudentNumberGroupCount === 0)
 *
 * @returns { ready: boolean, issues: string[], blockers: string[] }
 */
export async function checkPublicationReadiness({ examId, exam }) {
  const issues = [];
  const blockers = [];

  // Rule 1: Exam must be CLOSED
  if (exam.status !== "CLOSED") {
    issues.push(`Kỳ thi phải ở trạng thái CLOSED (hiện tại: ${exam.status}).`);
    blockers.push("EXAM_NOT_CLOSED");
  }

  // Count submissions
  const [
    totalSubmissions,
    provisionalCount,
    finalCount,
    identityNeedsReviewCount,
    unresolvedSbdCount,
  ] = await Promise.all([
    prisma.examSubmission.count({ where: { examId } }),
    prisma.examSubmission.count({ where: { examId, status: "PROVISIONAL" } }),
    prisma.examSubmission.count({ where: { examId, status: "FINAL" } }),
    prisma.examSubmission.count({ where: { examId, identityNeedsReview: true } }),
    prisma.examSubmission.count({
      where: {
        examId,
        OR: [{ resolvedStudentNumber: null }, { resolvedStudentNumber: "" }],
      },
    }),
  ]);

  // Rule 2: At least one submission exists
  if (totalSubmissions === 0) {
    issues.push("Kỳ thi chưa có bài nộp nào được chấm.");
    blockers.push("NO_RESULTS_TO_PUBLISH");
  } else {
    // Rule 3: At least one FINAL submission exists
    if (finalCount === 0) {
      issues.push("Kỳ thi chưa có bài nộp nào ở trạng thái hoàn tất (FINAL).");
      blockers.push("NO_FINAL_RESULTS");
    }

    // Rule 4: No PROVISIONAL submissions
    if (provisionalCount > 0) {
      issues.push(`Còn ${provisionalCount} bài nộp chưa được hoàn tất duyệt (PROVISIONAL).`);
      blockers.push("PROVISIONAL_SUBMISSIONS_EXIST");
    }

    // Rule 5: No identityNeedsReview
    if (identityNeedsReviewCount > 0) {
      issues.push(`Còn ${identityNeedsReviewCount} bài nộp chưa xác nhận số báo danh.`);
      blockers.push("UNCONFIRMED_IDENTITIES_EXIST");
    }

    // Rule 6: No missing SBD
    if (unresolvedSbdCount > 0) {
      issues.push(`Còn ${unresolvedSbdCount} bài nộp chưa có số báo danh hợp lệ.`);
      blockers.push("MISSING_STUDENT_NUMBERS_EXIST");
    }
  }

  // Rule 7: Detect duplicate confirmed SBDs (regardless of submission status)
  const confirmedSubmissions = await prisma.examSubmission.findMany({
    where: {
      examId,
      identityNeedsReview: false,
      resolvedStudentNumber: { not: null },
    },
    select: { resolvedStudentNumber: true },
  });

  const sbdCounts = new Map();
  for (const s of confirmedSubmissions) {
    const sbd = s.resolvedStudentNumber;
    sbdCounts.set(sbd, (sbdCounts.get(sbd) || 0) + 1);
  }
  const dupSbds = [...sbdCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dupSbds.length > 0) {
    issues.push(`Phát hiện ${dupSbds.length} số báo danh bị trùng: ${dupSbds.join(", ")}.`);
    blockers.push("DUPLICATE_STUDENT_NUMBERS_EXIST");
  }

  return {
    ready: issues.length === 0,
    issues,
    blockers,
    metrics: {
      totalSubmissions,
      finalCount,
      provisionalCount,
      identityNeedsReviewCount,
      duplicateStudentNumberGroupCount: dupSbds.length,
    },
  };
}

/**
 * Requests publication approval for official exams.
 * Initiated by EXAM_OFFICER or SUPER_ADMIN.
 */
export async function requestPublication({ examId, user, note }) {
  if (!["EXAM_OFFICER", "SUPER_ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ Cán bộ khảo thí hoặc Quản trị viên mới có quyền gửi yêu cầu phê duyệt công bố.", 403, "FORBIDDEN");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      examType: true,
      createdByUserId: true,
      resultsPublishedAt: true,
      publicationApprovalStatus: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  if (exam.status === "ARCHIVED") {
    throw new AppError("Kỳ thi đã được lưu trữ (ARCHIVED), không thể yêu cầu phê duyệt công bố.", 400, "EXAM_ARCHIVED");
  }

  if (exam.resultsPublishedAt) {
    throw new AppError("Kết quả kỳ thi này đã được công bố rồi.", 409, "RESULTS_ALREADY_PUBLISHED");
  }

  if (["PENDING_VICE_PRINCIPAL", "PENDING_APPROVAL", "PENDING_PRINCIPAL", "PENDING_PRINCIPAL_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    throw new AppError("Kỳ thi này đã được gửi yêu cầu phê duyệt trước đó và đang chờ xử lý.", 409, "ALREADY_PENDING_APPROVAL");
  }

  const readiness = await checkPublicationReadiness({ examId, exam });
  if (!readiness.ready) {
    throw new AppError(
      "Kỳ thi chưa đủ điều kiện công bố kết quả. Vui lòng kiểm tra và xử lý các lỗi trước khi gửi duyệt.",
      422,
      "PUBLICATION_READINESS_FAILED",
      { issues: readiness.issues, blockers: readiness.blockers }
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        publicationApprovalStatus: "PENDING_VICE_PRINCIPAL",
        publicationRequestedAt: now,
        publicationRequestedByUserId: user.id,
        academicReviewedAt: null,
        academicReviewedByUserId: null,
        principalApprovedAt: null,
        principalApprovedByUserId: null,
        publicationApprovedAt: null,
        publicationApprovedByUserId: null,
        publicationRejectionReason: null,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "APPROVAL_REQUESTED",
        note: note ? String(note).trim() : null,
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Approves publication request for official exams.
 * Handled by VICE_PRINCIPAL or SUPER_ADMIN.
 * Enforces self-approval restriction: creators/requesters cannot approve their own exams unless SUPER_ADMIN.
 */
export async function approvePublication({ examId, user, note }) {
  if (!["VICE_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ Hiệu phó chuyên môn hoặc Quản trị viên mới có quyền phê duyệt công bố.", 403, "FORBIDDEN");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      examType: true,
      createdByUserId: true,
      resultsPublishedAt: true,
      publicationApprovalStatus: true,
      publicationRequestedByUserId: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  if (!["PENDING_VICE_PRINCIPAL", "PENDING_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    throw new AppError("Kỳ thi không ở trạng thái chờ Hiệu phó phê duyệt công bố.", 400, "EXAM_NOT_PENDING_APPROVAL");
  }

  if (exam.publicationRequestedByUserId && exam.publicationRequestedByUserId === user.id) {
    throw new AppError(
      "Người gửi yêu cầu phê duyệt không được tự phê duyệt công bố kết quả kỳ thi.",
      403,
      "SELF_APPROVAL_FORBIDDEN"
    );
  }

  if (user.role !== "SUPER_ADMIN" && exam.createdByUserId === user.id) {
    throw new AppError(
      "Người tạo kỳ thi không được tự phê duyệt công bố kết quả.",
      403,
      "SELF_APPROVAL_FORBIDDEN"
    );
  }

  const readiness = await checkPublicationReadiness({ examId, exam });
  if (!readiness.ready) {
    throw new AppError(
      "Kỳ thi chưa đủ điều kiện công bố kết quả.",
      422,
      "PUBLICATION_READINESS_FAILED",
      { issues: readiness.issues, blockers: readiness.blockers }
    );
  }

  const now = new Date();
  const isFinalExam = exam.examType === "FINAL";

  await prisma.$transaction(async (tx) => {
    if (isFinalExam) {
      // Centralized FINAL: VP review -> PENDING_PRINCIPAL
      await tx.exam.update({
        where: { id: examId },
        data: {
          publicationApprovalStatus: "PENDING_PRINCIPAL",
          academicReviewedAt: now,
          academicReviewedByUserId: user.id,
          publicationRejectionReason: null,
        },
      });
      await tx.examResultPublicationLog.create({
        data: {
          examId,
          actorUserId: user.id,
          action: "VICE_PRINCIPAL_APPROVED",
          note: note ? String(note).trim() : "Hiệu phó chuyên môn đã thẩm định kết quả, chuyển hồ sơ trình Hiệu trưởng phê duyệt cuối.",
        },
      });
    } else {
      // Centralized MIDTERM (or other periodic official exams): VP approves -> APPROVED + AUTO-PUBLISH
      await tx.exam.update({
        where: { id: examId },
        data: {
          publicationApprovalStatus: "APPROVED",
          academicReviewedAt: now,
          academicReviewedByUserId: user.id,
          publicationApprovedAt: now,
          publicationApprovedByUserId: user.id,
          resultsPublishedAt: now,
          resultsPublishedByUserId: user.id,
          publicationRejectionReason: null,
        },
      });
      await tx.examResultPublicationLog.create({
        data: {
          examId,
          actorUserId: user.id,
          action: "VICE_PRINCIPAL_APPROVED",
          note: note ? String(note).trim() : "Hiệu phó chuyên môn đã thẩm định và phê duyệt kết quả kỳ thi.",
        },
      });
      await tx.examResultPublicationLog.create({
        data: {
          examId,
          actorUserId: user.id,
          action: "PUBLISHED",
          note: "Tự động công bố kết quả sau khi Hiệu phó chuyên môn phê duyệt.",
        },
      });
    }
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Phê duyệt cuối cùng từ Hiệu trưởng cho kỳ thi Cuối kỳ (FINAL).
 * Handled by PRINCIPAL or SUPER_ADMIN.
 * Sets resultsPublishedAt = now() in the same transaction (auto-published).
 */
export async function principalApprovePublication({ examId, user, note }) {
  if (!["PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ Hiệu trưởng hoặc Quản trị viên mới có quyền phê duyệt cuối cùng.", 403, "FORBIDDEN");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      examType: true,
      status: true,
      createdByUserId: true,
      resultsPublishedAt: true,
      publicationApprovalStatus: true,
      publicationRequestedByUserId: true,
      academicReviewedAt: true,
      academicReviewedByUserId: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  if (!["PENDING_PRINCIPAL", "PENDING_PRINCIPAL_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    throw new AppError(
      "Kỳ thi chưa qua bước thẩm định của Hiệu phó hoặc không ở trạng thái chờ Hiệu trưởng phê duyệt.",
      400,
      "ACADEMIC_REVIEW_REQUIRED"
    );
  }

  // 4-Eyes governance: Requesters or creators cannot do Principal final approval unless SUPER_ADMIN
  if (user.role !== "SUPER_ADMIN" && exam.publicationRequestedByUserId === user.id) {
    throw new AppError(
      "Người gửi yêu cầu phê duyệt không được tự phê duyệt công bố kết quả kỳ thi.",
      403,
      "SELF_APPROVAL_FORBIDDEN"
    );
  }

  if (user.role !== "SUPER_ADMIN" && exam.createdByUserId === user.id) {
    throw new AppError(
      "Người tạo kỳ thi không được tự phê duyệt công bố kết quả.",
      403,
      "SELF_APPROVAL_FORBIDDEN"
    );
  }

  if (user.role !== "SUPER_ADMIN" && exam.academicReviewedByUserId === user.id) {
    throw new AppError(
      "Người đã thẩm định học vụ không được kiêm nhiệm phê duyệt cuối của Hiệu trưởng.",
      403,
      "SEPARATION_OF_DUTIES_VIOLATION"
    );
  }

  const readiness = await checkPublicationReadiness({ examId, exam });
  if (!readiness.ready) {
    throw new AppError(
      "Kỳ thi chưa đủ điều kiện công bố kết quả.",
      422,
      "PUBLICATION_READINESS_FAILED",
      { issues: readiness.issues, blockers: readiness.blockers }
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        publicationApprovalStatus: "APPROVED",
        principalApprovedAt: now,
        principalApprovedByUserId: user.id,
        publicationApprovedAt: now,
        publicationApprovedByUserId: user.id,
        resultsPublishedAt: now,
        resultsPublishedByUserId: user.id,
        publicationRejectionReason: null,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "PRINCIPAL_APPROVED",
        note: note ? String(note).trim() : "Hiệu trưởng đã phê duyệt kết quả kỳ thi.",
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "PUBLISHED",
        note: "Tự động công bố kết quả sau khi Hiệu trưởng phê duyệt.",
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Rejects publication request with a mandatory reason.
 * Handled by VICE_PRINCIPAL or SUPER_ADMIN.
 */
export async function rejectPublication({ examId, user, reason }) {
  if (!["VICE_PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ Hiệu phó chuyên môn hoặc Quản trị viên mới có quyền từ chối phê duyệt thẩm định.", 403, "FORBIDDEN");
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new AppError("Lý do từ chối phê duyệt là bắt buộc.", 400, "REJECTION_REASON_REQUIRED");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      publicationApprovalStatus: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  if (!["PENDING_VICE_PRINCIPAL", "PENDING_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    throw new AppError("Kỳ thi không ở trạng thái chờ phê duyệt công bố.", 400, "EXAM_NOT_PENDING_APPROVAL");
  }

  const trimmedReason = reason.trim();
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        publicationApprovalStatus: "REJECTED",
        academicReviewedAt: null,
        academicReviewedByUserId: null,
        resultsPublishedAt: null,
        resultsPublishedByUserId: null,
        publicationRejectionReason: trimmedReason,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "VICE_PRINCIPAL_REJECTED",
        note: trimmedReason,
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Hiệu trưởng từ chối phê duyệt kết quả kỳ thi Cuối kỳ.
 * Handled by PRINCIPAL or SUPER_ADMIN.
 */
export async function principalRejectPublication({ examId, user, reason }) {
  if (!["PRINCIPAL", "SUPER_ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ Hiệu trưởng hoặc Quản trị viên mới có quyền từ chối phê duyệt.", 403, "FORBIDDEN");
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new AppError("Lý do từ chối phê duyệt là bắt buộc.", 400, "REJECTION_REASON_REQUIRED");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      examType: true,
      publicationApprovalStatus: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  if (!["PENDING_PRINCIPAL", "PENDING_PRINCIPAL_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    throw new AppError("Kỳ thi không ở trạng thái chờ Hiệu trưởng phê duyệt.", 400, "EXAM_NOT_PENDING_PRINCIPAL_APPROVAL");
  }

  const trimmedReason = reason.trim();
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        publicationApprovalStatus: "REJECTED",
        principalApprovedAt: null,
        principalApprovedByUserId: null,
        academicReviewedAt: null,
        academicReviewedByUserId: null,
        resultsPublishedAt: null,
        resultsPublishedByUserId: null,
        publicationRejectionReason: trimmedReason,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "PRINCIPAL_REJECTED",
        note: trimmedReason,
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Returns publication approval queue list for oversight / review.
 */
export async function getPublicationApprovalQueue({ user, query = {} }) {
  if (!["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER"].includes(user.role)) {
    throw new AppError("Bạn không có quyền truy cập hàng đợi phê duyệt công bố.", 403, "FORBIDDEN");
  }

  const { page = 1, limit = 20, status, target } = query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (target === "principal" || user.role === "PRINCIPAL") {
    // Principal approval queue: high stakes exams waiting for Principal or already approved
    if (status && status !== "ALL") {
      where.publicationApprovalStatus = status;
    } else if (!status) {
      where.publicationApprovalStatus = { in: ["PENDING_PRINCIPAL", "PENDING_PRINCIPAL_APPROVAL"] };
    }
    where.examType = { in: ["MIDTERM", "FINAL"] };
  } else if (target === "vice_principal" || target === "academic" || user.role === "VICE_PRINCIPAL") {
    if (status && status !== "ALL") {
      where.publicationApprovalStatus = status;
    } else if (!status) {
      where.publicationApprovalStatus = { in: ["PENDING_VICE_PRINCIPAL", "PENDING_APPROVAL"] };
    }
  } else {
    if (status && status !== "ALL") {
      where.publicationApprovalStatus = status;
    }
  }

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        grade: { select: { id: true, name: true, level: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true, teacherCode: true } },
        createdByUser: { select: { id: true, fullName: true, email: true, role: true } },
        publicationRequestedByUser: { select: { id: true, fullName: true, email: true, role: true } },
        publicationApprovedByUser: { select: { id: true, fullName: true, email: true, role: true } },
        academicReviewedByUser: { select: { id: true, fullName: true, email: true, role: true } },
        principalApprovedByUser: { select: { id: true, fullName: true, email: true, role: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { publicationRequestedAt: "desc" },
      skip,
      take: limitNum,
    }),
  ]);

  return {
    data: exams,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Publishes exam results.
 * For routine exams: teacher/super_admin can publish directly once ready.
 * For official exams: publication requires prior approval from VICE_PRINCIPAL.
 * For MIDTERM / FINAL: publication requires prior final approval from PRINCIPAL.
 */
export async function publishExamResults({ examId, user, note }) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      teacherId: true,
      createdByUserId: true,
      title: true,
      status: true,
      examType: true,
      resultsPublishedAt: true,
      publicationApprovalStatus: true,
      principalApprovedAt: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  const isOfficial = ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType);

  if (isOfficial) {
    if (!["EXAM_OFFICER", "SUPER_ADMIN"].includes(user.role)) {
      throw new AppError("Chỉ Cán bộ khảo thí hoặc Quản trị viên mới có quyền công bố kết quả kỳ thi chính quy.", 403, "FORBIDDEN");
    }
    if (exam.publicationApprovalStatus !== "APPROVED") {
      throw new AppError(
        "Kỳ thi chính quy yêu cầu hoàn tất phê duyệt trước khi công bố kết quả.",
        403,
        "PUBLICATION_APPROVAL_REQUIRED"
      );
    }
    if (exam.examType === "FINAL" && !exam.principalApprovedAt) {
      throw new AppError(
        "Kỳ thi Cuối kỳ bắt buộc phải có phê duyệt cuối của Hiệu trưởng trước khi công bố kết quả.",
        403,
        "PRINCIPAL_APPROVAL_REQUIRED"
      );
    }
  } else {
    // Routine exams (REGULAR, MIN_15)
    if (user.role === "TEACHER") {
      const teacher = await getTeacherProfile(user.id);
      if (exam.teacherId !== teacher.id && exam.createdByUserId !== user.id) {
        throw new AppError("Bạn không có quyền công bố kết quả kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
      }
    } else if (user.role !== "SUPER_ADMIN") {
      throw new AppError("Chỉ giáo viên sở hữu kỳ thi hoặc Quản trị viên mới có quyền công bố kết quả.", 403, "FORBIDDEN");
    }
  }

  if (exam.status === "ARCHIVED") {
    throw new AppError("Kỳ thi đã được lưu trữ (ARCHIVED), không thể công bố kết quả.", 400, "EXAM_ARCHIVED");
  }

  if (exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi này đã được công bố rồi.",
      409,
      "RESULTS_ALREADY_PUBLISHED"
    );
  }

  // Server-side readiness re-evaluation
  const readiness = await checkPublicationReadiness({ examId, exam });
  if (!readiness.ready) {
    throw new AppError(
      "Kỳ thi chưa đủ điều kiện công bố kết quả.",
      422,
      "PUBLICATION_READINESS_FAILED",
      { issues: readiness.issues, blockers: readiness.blockers }
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        resultsPublishedAt: now,
        resultsPublishedByUserId: user.id,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "PUBLISHED",
        note: note ? String(note).trim() : null,
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Un-publishes exam results (reverts publication).
 */
export async function unpublishExamResults({ examId, user, note }) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      teacherId: true,
      createdByUserId: true,
      title: true,
      status: true,
      examType: true,
      resultsPublishedAt: true,
      publicationApprovalStatus: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  const isOfficial = ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType);
  if (isOfficial) {
    if (!["EXAM_OFFICER", "SUPER_ADMIN"].includes(user.role)) {
      throw new AppError("Chỉ Cán bộ khảo thí hoặc Quản trị viên mới có quyền gỡ công bố kết quả kỳ thi chính quy.", 403, "FORBIDDEN");
    }
  } else {
    if (user.role === "TEACHER") {
      const teacher = await getTeacherProfile(user.id);
      if (exam.teacherId !== teacher.id && exam.createdByUserId !== user.id) {
        throw new AppError("Bạn không có quyền gỡ công bố kết quả kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
      }
    } else if (user.role !== "SUPER_ADMIN") {
      throw new AppError("Chỉ giáo viên sở hữu kỳ thi hoặc Quản trị viên mới có quyền gỡ công bố kết quả.", 403, "FORBIDDEN");
    }
  }

  if (exam.status === "ARCHIVED") {
    throw new AppError("Kỳ thi đã được lưu trữ (ARCHIVED), không thể thay đổi trạng thái công bố.", 400, "EXAM_ARCHIVED");
  }

  if (!exam.resultsPublishedAt) {
    throw new AppError("Kết quả kỳ thi này hiện chưa được công bố.", 409, "RESULTS_NOT_PUBLISHED");
  }

  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        resultsPublishedAt: null,
        resultsPublishedByUserId: null,
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id,
        action: "UNPUBLISHED",
        note: note ? String(note).trim() : null,
      },
    });
  });

  return getPublicationStatus({ examId, user });
}

/**
 * Returns comprehensive publication status for an exam.
 */
export async function getPublicationStatus({ examId, user }) {
  if (user.role === "SUPER_ADMIN") {
    throw new AppError(
      "Quản trị viên không có quyền truy cập trạng thái công bố kết quả.",
      403,
      "FORBIDDEN"
    );
  }

  await assertExamAccess(examId, user);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      examType: true,
      teacherId: true,
      createdByUserId: true,
      resultsPublishedAt: true,
      resultsPublishedByUserId: true,
      resultsPublishedByUser: { select: { id: true, email: true, fullName: true } },
      publicationApprovalStatus: true,
      publicationRequestedAt: true,
      publicationRequestedByUserId: true,
      publicationRequestedByUser: { select: { id: true, email: true, fullName: true, role: true } },
      publicationApprovedAt: true,
      publicationApprovedByUserId: true,
      publicationApprovedByUser: { select: { id: true, email: true, fullName: true, role: true } },
      academicReviewedAt: true,
      academicReviewedByUserId: true,
      academicReviewedByUser: { select: { id: true, email: true, fullName: true, role: true } },
      principalApprovedAt: true,
      principalApprovedByUserId: true,
      principalApprovedByUser: { select: { id: true, email: true, fullName: true, role: true } },
      publicationRejectionReason: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");

  const isOfficial = ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType);
  const requiresPrincipalApproval = ["MIDTERM", "FINAL"].includes(exam.examType);
  const readiness = await checkPublicationReadiness({ examId, exam });

  const canApprove =
    ["VICE_PRINCIPAL", "SUPER_ADMIN"].includes(user.role) &&
    (user.role === "SUPER_ADMIN" ||
      (exam.createdByUserId !== user.id && exam.publicationRequestedByUserId !== user.id));

  const canPrincipalApprove =
    requiresPrincipalApproval &&
    ["PRINCIPAL", "SUPER_ADMIN"].includes(user.role) &&
    (user.role === "SUPER_ADMIN" ||
      (exam.createdByUserId !== user.id &&
        exam.publicationRequestedByUserId !== user.id &&
        exam.academicReviewedByUserId !== user.id));

  let approvalStage = "NOT_REQUESTED";
  let approvalStageLabel = "Chưa gửi duyệt";

  if (exam.resultsPublishedAt) {
    approvalStage = "PUBLISHED";
    approvalStageLabel = "Đã công bố";
  } else if (exam.publicationApprovalStatus === "APPROVED") {
    approvalStage = "APPROVED";
    approvalStageLabel = "Đã được phê duyệt";
  } else if (["PENDING_PRINCIPAL", "PENDING_PRINCIPAL_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    approvalStage = "PENDING_PRINCIPAL";
    approvalStageLabel = "Chờ Hiệu trưởng phê duyệt";
  } else if (["PENDING_VICE_PRINCIPAL", "PENDING_APPROVAL"].includes(exam.publicationApprovalStatus)) {
    approvalStage = "PENDING_VICE_PRINCIPAL";
    approvalStageLabel = "Chờ Hiệu phó chuyên môn phê duyệt";
  } else if (exam.publicationApprovalStatus === "REJECTED") {
    approvalStage = "REJECTED";
    approvalStageLabel = exam.academicReviewedAt ? "Hiệu trưởng từ chối" : "Hiệu phó chuyên môn từ chối";
  }

  return {
    examId,
    examStatus: exam.status,
    examType: exam.examType,
    isOfficialExam: isOfficial,
    requiresPrincipalApproval,
    isPublished: !!exam.resultsPublishedAt,
    publishedAt: exam.resultsPublishedAt,
    publishedBy: exam.resultsPublishedByUser,
    publicationApprovalStatus: exam.publicationApprovalStatus,
    approvalStage,
    approvalStageLabel,
    publicationRequestedAt: exam.publicationRequestedAt,
    publicationRequestedBy: exam.publicationRequestedByUser,
    publicationApprovedAt: exam.publicationApprovedAt,
    publicationApprovedBy: exam.publicationApprovedByUser,
    academicReviewedAt: exam.academicReviewedAt,
    academicReviewedBy: exam.academicReviewedByUser,
    principalApprovedAt: exam.principalApprovedAt,
    principalApprovedBy: exam.principalApprovedByUser,
    publicationRejectionReason: exam.publicationRejectionReason,
    canApprove,
    canPrincipalApprove,
    readiness,
  };
}

/**
 * Returns chronological publication logs for an exam.
 */
export async function getPublicationLogs({ examId, user }) {
  await assertExamAccess(examId, user);

  const logs = await prisma.examResultPublicationLog.findMany({
    where: { examId },
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          teacher: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    note: log.note,
    actor: {
      id: log.actorUser.id,
      email: log.actorUser.email,
      fullName: log.actorUser.fullName || log.actorUser.teacher?.fullName || log.actorUser.email,
      role: log.actorUser.role,
    },
    createdAt: log.createdAt,
  }));
}

/**
 * Asserts that results are NOT published (used to guard review/identity mutations).
 * Throws RESULTS_PUBLISHED_LOCKED if exam results are published.
 */
export async function assertResultsNotPublished(examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { resultsPublishedAt: true },
  });
  if (exam?.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi đã được công bố. Không thể chỉnh sửa bài nộp sau khi đã công bố.",
      403,
      "RESULTS_PUBLISHED_LOCKED"
    );
  }
}