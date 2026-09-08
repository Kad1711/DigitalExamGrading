import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { getTeacherProfile } from "./exam.service.js";
import { normalizeExamCode } from "../utils/exam-code.js";

/**
 * Asserts TEACHER-only access to an exam for submission listing.
 * Admin cannot access submission lists (core security rule).
 */
async function assertTeacherExamAccess(examId, reqUser) {
  if (reqUser.role !== "TEACHER") {
    throw new AppError(
      "Chi giao vien so huu ky thi moi co quyen xem danh sach bai nop.",
      403,
      "FORBIDDEN"
    );
  }
  const teacher = await getTeacherProfile(reqUser.id);
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, teacherId: true, title: true, status: true, questionCount: true, maxScore: true },
  });
  if (!exam) {
    throw new AppError("Ky thi khong ton tai.", 404, "EXAM_NOT_FOUND");
  }
  if (exam.teacherId !== teacher.id) {
    throw new AppError(
      "Ban khong co quyen truy cap danh sach bai nop cua ky thi nay.",
      403,
      "EXAM_ACCESS_DENIED"
    );
  }
  return { exam, teacher };
}

/**
 * Lists exam submissions with pagination and filters.
 *
 * Filters:
 *   status         - PROVISIONAL | FINAL
 *   identityStatus - NEEDS_REVIEW | RESOLVED
 *   examCode       - string filter on examCodeSnapshot (normalized matching)
 *   duplicate      - "true" to return only duplicate SBD submissions
 *   search         - partial match on resolvedStudentNumber or detectedStudentNumber
 *
 * Duplicate detection semantics:
 *   same examId, non-null resolvedStudentNumber, identityNeedsReview = false, count > 1
 *   (does not require submission to be FINAL)
 *
 * @returns { submissions, total, page, pageSize, totalPages, hasDuplicateSbd, duplicateGroupCount, duplicateSubmissionCount }
 */
export async function listExamSubmissions({ examId, user, query }) {
  await assertTeacherExamAccess(examId, user);

  const {
    page = 1,
    pageSize = 20,
    status,
    identityStatus,
    examCode,
    duplicate,
    search,
    sort = "createdAt",
    order = "desc",
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

  // 1. Detect duplicate confirmed SBDs in this exam
  const confirmedSubmissions = await prisma.examSubmission.findMany({
    where: {
      examId,
      identityNeedsReview: false,
      resolvedStudentNumber: { not: null },
    },
    select: { id: true, resolvedStudentNumber: true },
  });

  const sbdCounts = new Map();
  for (const s of confirmedSubmissions) {
    const sbd = s.resolvedStudentNumber;
    sbdCounts.set(sbd, (sbdCounts.get(sbd) || 0) + 1);
  }

  const duplicateSbds = new Set(
    [...sbdCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  );

  let duplicateGroupCount = 0;
  let duplicateSubmissionCount = 0;
  for (const count of sbdCounts.values()) {
    if (count > 1) {
      duplicateGroupCount += 1;
      duplicateSubmissionCount += count;
    }
  }

  // 2. Build where clause
  const where = { examId };

  if (status && ["PROVISIONAL", "FINAL"].includes(status)) {
    where.status = status;
  }

  if (identityStatus === "NEEDS_REVIEW") {
    where.identityNeedsReview = true;
  } else if (identityStatus === "RESOLVED") {
    where.identityNeedsReview = false;
  }

  // Exam code normalization filter (matches "001", "01", "1")
  if (examCode && String(examCode).trim() !== "") {
    const trimmed = String(examCode).trim();
    let targetCodes = [trimmed];
    try {
      const norm = normalizeExamCode(trimmed);
      const intVal = parseInt(trimmed, 10);
      targetCodes = Array.from(new Set([
        trimmed,
        norm,
        String(intVal),
        String(intVal).padStart(2, "0"),
        String(intVal).padStart(3, "0"),
      ]));
    } catch {
      // not numeric, keep trimmed
    }
    where.examCodeSnapshot = { in: targetCodes };
  }

  // Duplicate SBD only filter
  if (duplicate === "true" || duplicate === true) {
    if (duplicateSbds.size > 0) {
      where.resolvedStudentNumber = { in: Array.from(duplicateSbds) };
      where.identityNeedsReview = false;
    } else {
      // No duplicate SBDs exist, return empty result
      where.id = "none_match_filter";
    }
  }

  if (search) {
    where.OR = [
      { resolvedStudentNumber: { contains: search } },
      { detectedStudentNumber: { contains: search } },
      { candidateStudentNumber: { contains: search } },
    ];
  }

  // Validate sort field
  const ALLOWED_SORT_FIELDS = [
    "createdAt",
    "finalizedAt",
    "finalScore",
    "provisionalScore",
    "resolvedStudentNumber",
    "examCodeSnapshot",
    "status",
  ];
  const sortField = ALLOWED_SORT_FIELDS.includes(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? "asc" : "desc";

  const [total, submissions] = await Promise.all([
    prisma.examSubmission.count({ where }),
    prisma.examSubmission.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      select: {
        id: true,
        status: true,
        examCodeSnapshot: true,
        resolvedStudentNumber: true,
        detectedStudentNumber: true,
        candidateStudentNumber: true,
        studentNumberOmrStatus: true,
        identityNeedsReview: true,
        identityReviewedAt: true,
        correctCount: true,
        incorrectCount: true,
        blankCount: true,
        unresolvedCount: true,
        provisionalScore: true,
        finalScore: true,
        questionCountSnapshot: true,
        maxScoreSnapshot: true,
        scoringTypeSnapshot: true,
        omrOverallStatus: true,
        createdAt: true,
        updatedAt: true,
        finalizedAt: true,
        gradedByUser: { select: { id: true, email: true } },
      },
    }),
  ]);

  const formattedSubmissions = submissions.map((sub) => ({
    id: sub.id,
    status: sub.status,
    examCode: sub.examCodeSnapshot,
    studentNumber: {
      detected: sub.detectedStudentNumber,
      candidate: sub.candidateStudentNumber,
      resolved: sub.resolvedStudentNumber,
      omrStatus: sub.studentNumberOmrStatus,
      needsReview: sub.identityNeedsReview,
      reviewedAt: sub.identityReviewedAt,
    },
    isDuplicateSbd:
      !sub.identityNeedsReview &&
      sub.resolvedStudentNumber !== null &&
      duplicateSbds.has(sub.resolvedStudentNumber),
    grading: {
      correctCount: sub.correctCount,
      incorrectCount: sub.incorrectCount,
      blankCount: sub.blankCount,
      unresolvedCount: sub.unresolvedCount,
      finalScore: sub.finalScore !== null ? Number(sub.finalScore) : null,
      provisionalScore: sub.provisionalScore !== null ? Number(sub.provisionalScore) : null,
      maxScore: Number(sub.maxScoreSnapshot),
      questionCount: sub.questionCountSnapshot,
    },
    omrOverallStatus: sub.omrOverallStatus,
    gradedBy: sub.gradedByUser,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    finalizedAt: sub.finalizedAt,
  }));

  return {
    submissions: formattedSubmissions,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
    totalPages: Math.ceil(total / pageSizeNum),
    hasDuplicateSbd: duplicateSbds.size > 0,
    duplicateStudentNumberGroupCount: duplicateGroupCount,
    duplicateSubmissionCount: duplicateSubmissionCount,
  };
}

/**
 * Returns a summary of submission statistics for an exam.
 */
export async function getExamSubmissionsSummary({ examId, user }) {
  await assertTeacherExamAccess(examId, user);

  const [totalSubmissions, provisionalCount, finalCount, identityNeedsReviewCount, needsAnswerReviewCount] = await Promise.all([
    prisma.examSubmission.count({ where: { examId } }),
    prisma.examSubmission.count({ where: { examId, status: "PROVISIONAL" } }),
    prisma.examSubmission.count({ where: { examId, status: "FINAL" } }),
    prisma.examSubmission.count({ where: { examId, identityNeedsReview: true } }),
    prisma.examSubmission.count({ where: { examId, unresolvedCount: { gt: 0 } } }),
  ]);

  // Detect duplicate confirmed SBDs
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

  let duplicateStudentNumberGroupCount = 0;
  let duplicateSubmissionCount = 0;
  for (const count of sbdCounts.values()) {
    if (count > 1) {
      duplicateStudentNumberGroupCount += 1;
      duplicateSubmissionCount += count;
    }
  }

  // Score stats for FINAL submissions ONLY
  const scoreStats = await prisma.examSubmission.aggregate({
    where: { examId, status: "FINAL", finalScore: { not: null } },
    _avg: { finalScore: true },
    _max: { finalScore: true },
    _min: { finalScore: true },
  });

  return {
    totalSubmissions,
    total: totalSubmissions,
    finalCount,
    final: finalCount,
    provisionalCount,
    provisional: provisionalCount,
    identityNeedsReviewCount,
    needsIdentityReview: identityNeedsReviewCount,
    needsAnswerReviewCount,
    needsAnswerReview: needsAnswerReviewCount,
    duplicateStudentNumberGroupCount,
    duplicateSubmissionCount,
    duplicateSbdCount: duplicateStudentNumberGroupCount,
    scoreStats: {
      avg: scoreStats._avg.finalScore !== null ? Number(scoreStats._avg.finalScore) : null,
      max: scoreStats._max.finalScore !== null ? Number(scoreStats._max.finalScore) : null,
      min: scoreStats._min.finalScore !== null ? Number(scoreStats._min.finalScore) : null,
    },
  };
}