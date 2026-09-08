import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { getTeacherProfile } from "./exam.service.js";

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
 * Publishes exam results.
 * Locks submissions against review/identity mutations after publication.
 */
export async function publishExamResults({ examId, user, note }) {
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền công bố kết quả.", 403, "FORBIDDEN");
  }
  const teacher = await getTeacherProfile(user.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, teacherId: true, title: true, status: true, resultsPublishedAt: true },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền công bố kết quả kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
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
        resultsPublishedByUserId: user.id, // Strictly authenticated actor
      },
    });
    await tx.examResultPublicationLog.create({
      data: {
        examId,
        actorUserId: user.id, // Strictly authenticated actor
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
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền thu hồi công bố kết quả.", 403, "FORBIDDEN");
  }
  const teacher = await getTeacherProfile(user.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, teacherId: true, title: true, status: true, resultsPublishedAt: true },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền thao tác trên kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
  }

  if (exam.status === "ARCHIVED") {
    throw new AppError("Kỳ thi đã được lưu trữ (ARCHIVED), không thể thu hồi công bố.", 400, "EXAM_ARCHIVED");
  }

  if (!exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi này chưa được công bố.",
      409,
      "RESULTS_NOT_PUBLISHED"
    );
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
 * Returns current publication status of an exam.
 */
export async function getPublicationStatus({ examId, user }) {
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền xem trạng thái công bố.", 403, "FORBIDDEN");
  }
  const teacher = await getTeacherProfile(user.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      teacherId: true,
      resultsPublishedAt: true,
      resultsPublishedByUserId: true,
      resultsPublishedByUser: { select: { id: true, email: true } },
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền truy cập thông tin này.", 403, "EXAM_ACCESS_DENIED");
  }

  const readiness = await checkPublicationReadiness({ examId, exam });

  return {
    examId,
    examStatus: exam.status,
    isPublished: !!exam.resultsPublishedAt,
    publishedAt: exam.resultsPublishedAt,
    publishedBy: exam.resultsPublishedByUser,
    readiness,
  };
}

/**
 * Returns chronological publication logs for an exam.
 */
export async function getPublicationLogs({ examId, user }) {
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền xem lịch sử công bố.", 403, "FORBIDDEN");
  }
  const teacher = await getTeacherProfile(user.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, teacherId: true },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền truy cập lịch sử này.", 403, "EXAM_ACCESS_DENIED");
  }

  const logs = await prisma.examResultPublicationLog.findMany({
    where: { examId },
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
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
      fullName: log.actorUser.teacher?.fullName || log.actorUser.email,
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