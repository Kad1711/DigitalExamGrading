import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { normalizeExamCode } from "../utils/exam-code.js";

export async function getExamAnalytics(teacherUserId, examId) {
  // Verify ownership
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      teacher: true,
      subject: { select: { code: true, name: true } },
      class: { select: { id: true, name: true } },
    },
  });

  if (!exam) {
    throw new AppError("Kỳ thi không tồn tại hoặc đã bị xóa.", 404, "EXAM_NOT_FOUND");
  }

  if (exam.teacher?.userId !== teacherUserId) {
    throw new AppError("Bạn không có quyền truy cập kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
  }

  // Fetch all submissions for this exam with answers
  const submissions = await prisma.examSubmission.findMany({
    where: { examId },
    include: {
      answers: {
        orderBy: { questionNumber: "asc" },
      },
      auditLogs: {
        select: { eventType: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalSubmissions = submissions.length;
  const finalSubmissions = submissions.filter((s) => s.status === "FINAL");
  const provisionalSubmissions = submissions.filter((s) => s.status === "PROVISIONAL");
  const identityNeedsReviewCount = submissions.filter((s) => s.identityNeedsReview).length;

  const finalCount = finalSubmissions.length;
  const provisionalCount = provisionalSubmissions.length;

  // Overview
  const overview = {
    examId: exam.id,
    examTitle: exam.title,
    subject: exam.subject,
    className: exam.class?.name || null,
    status: exam.status,
    isPublished: exam.resultsPublishedAt !== null,
    publishedAt: exam.resultsPublishedAt,
    totalSubmissions,
    finalCount,
    provisionalCount,
    identityNeedsReviewCount,
  };

  // Consistency check across FINAL submissions
  let consistencyWarning = false;
  let consistencyCode = null;
  let consistencyDetail = null;

  if (finalCount > 1) {
    const firstQCount = finalSubmissions[0].questionCountSnapshot;
    const firstMaxScore = Number(finalSubmissions[0].maxScoreSnapshot);
    const firstScoringType = finalSubmissions[0].scoringTypeSnapshot;

    for (const sub of finalSubmissions) {
      if (
        sub.questionCountSnapshot !== firstQCount ||
        Number(sub.maxScoreSnapshot) !== firstMaxScore ||
        sub.scoringTypeSnapshot !== firstScoringType
      ) {
        consistencyWarning = true;
        consistencyCode = "ANALYTICS_DATA_INCONSISTENT";
        consistencyDetail = "Các bài thi hoàn tất có cấu hình điểm hoặc số câu hỏi không đồng nhất.";
        break;
      }
    }
  }

  // Score statistics (FINAL only)
  let scoreStats = {
    averageFinalScore: null,
    highestFinalScore: null,
    lowestFinalScore: null,
    medianFinalScore: null,
    perfectScoreCount: null,
  };

  const scoreDistribution = [];
  const questionAnalytics = [];
  const examCodeComparison = [];

  const examMaxScore = exam.maxScore ? Number(exam.maxScore) : 10;

  if (finalCount > 0) {
    const scores = finalSubmissions
      .map((s) => (s.finalScore !== null ? Number(s.finalScore) : 0))
      .sort((a, b) => a - b);

    const sum = scores.reduce((acc, val) => acc + val, 0);
    const avg = Math.round((sum / scores.length) * 100) / 100;
    const lowest = scores[0];
    const highest = scores[scores.length - 1];

    let median;
    const mid = Math.floor(scores.length / 2);
    if (scores.length % 2 === 0) {
      median = Math.round(((scores[mid - 1] + scores[mid]) / 2) * 100) / 100;
    } else {
      median = scores[mid];
    }

    const perfectScoreCount = scores.filter((sc) => Math.abs(sc - examMaxScore) < 0.001).length;

    scoreStats = {
      averageFinalScore: avg,
      highestFinalScore: highest,
      lowestFinalScore: lowest,
      medianFinalScore: median,
      perfectScoreCount,
    };

    // 10 buckets
    const bucketStep = examMaxScore / 10;
    for (let i = 0; i < 10; i++) {
      const min = Math.round(i * bucketStep * 100) / 100;
      const max = Math.round((i + 1) * bucketStep * 100) / 100;
      const isLast = i === 9;
      const label = isLast ? `${min} - ${max}` : `${min} - <${max}`;

      const count = scores.filter((sc) => {
        if (isLast) {
          return sc >= min && sc <= max;
        }
        return sc >= min && sc < max;
      }).length;

      scoreDistribution.push({ label, min, max, count });
    }

    // Question-level performance (from FINAL only)
    const questionCount = exam.questionCount || (finalSubmissions[0]?.questionCountSnapshot ?? 40);
    for (let q = 1; q <= questionCount; q++) {
      const qAnswers = [];
      for (const sub of finalSubmissions) {
        const a = sub.answers.find((ans) => ans.questionNumber === q);
        if (a) qAnswers.push(a);
      }

      const totalFinalResponses = qAnswers.length;
      const correctCount = qAnswers.filter((a) => a.result === "CORRECT").length;
      const incorrectCount = qAnswers.filter((a) => a.result === "INCORRECT").length;
      const blankCount = qAnswers.filter((a) => a.result === "BLANK").length;
      const invalidMultipleCount = qAnswers.filter((a) => a.result === "INVALID_MULTIPLE").length;

      const correctAnswerSnapshot = qAnswers[0]?.correctAnswerSnapshot || null;

      const answerDistribution = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        BLANK: blankCount,
        INVALID_MULTIPLE: invalidMultipleCount,
      };

      for (const a of qAnswers) {
        if (a.result === "CORRECT" || a.result === "INCORRECT") {
          const opt = a.effectiveAnswer || a.detectedAnswer;
          if (opt && answerDistribution[opt] !== undefined) {
            answerDistribution[opt]++;
          }
        }
      }

      const correctRate =
        totalFinalResponses > 0
          ? Math.round((correctCount / totalFinalResponses) * 1000) / 10
          : 0;
      const blankRate =
        totalFinalResponses > 0
          ? Math.round((blankCount / totalFinalResponses) * 1000) / 10
          : 0;
      const invalidRate =
        totalFinalResponses > 0
          ? Math.round((invalidMultipleCount / totalFinalResponses) * 1000) / 10
          : 0;

      questionAnalytics.push({
        questionNumber: q,
        correctAnswer: correctAnswerSnapshot,
        totalFinalResponses,
        correctCount,
        incorrectCount,
        blankCount,
        invalidMultipleCount,
        correctRate,
        blankRate,
        invalidRate,
        answerDistribution,
      });
    }

    // ExamCode comparison (from FINAL only)
    const codeMap = new Map();
    for (const sub of finalSubmissions) {
      const rawCode = sub.examCodeSnapshot || "001";
      const normCode = normalizeExamCode(rawCode);
      if (!codeMap.has(normCode)) {
        codeMap.set(normCode, []);
      }
      codeMap.get(normCode).push(sub.finalScore !== null ? Number(sub.finalScore) : 0);
    }

    for (const [code, codeScores] of codeMap.entries()) {
      const cSum = codeScores.reduce((a, b) => a + b, 0);
      const cAvg = Math.round((cSum / codeScores.length) * 100) / 100;
      const cMin = Math.min(...codeScores);
      const cMax = Math.max(...codeScores);
      examCodeComparison.push({
        code,
        candidateCount: codeScores.length,
        averageScore: cAvg,
        lowestScore: cMin,
        highestScore: cMax,
      });
    }
    examCodeComparison.sort((a, b) => a.code.localeCompare(b.code));
  }

  // Recognition and Review Quality Summary (across all submissions)
  let teacherReviewedAnswerCount = 0;
  let invalidMultipleCount = 0;
  let identityReviewCount = 0;
  let submissionsNeedingManualReview = 0;

  const omrStatusCounts = {
    MARKED: 0,
    BLANK: 0,
    UNCERTAIN: 0,
    MULTIPLE: 0,
  };

  for (const sub of submissions) {
    if (sub.identityReviewedAt !== null) {
      identityReviewCount++;
    }

    const hasAnswerReviewAudit = sub.auditLogs?.some(
      (log) => log.eventType === "ANSWER_REVIEWED"
    );
    const hasReviewedAnswer = sub.answers.some((a) => a.resolvedByTeacher);

    if (hasAnswerReviewAudit || hasReviewedAnswer || sub.unresolvedCount > 0) {
      submissionsNeedingManualReview++;
    }

    for (const a of sub.answers) {
      if (a.resolvedByTeacher) {
        teacherReviewedAnswerCount++;
      }
      if (a.result === "INVALID_MULTIPLE" || a.teacherResolution === "MULTIPLE_INVALID") {
        invalidMultipleCount++;
      }
      if (a.omrStatus && omrStatusCounts[a.omrStatus] !== undefined) {
        omrStatusCounts[a.omrStatus]++;
      }
    }
  }

  const reviewWorkload = {
    submissionsNeedingManualReview,
    teacherReviewedAnswerCount,
    identityReviewCount,
    invalidMultipleCount,
    omrStatusCounts,
  };

  return {
    overview,
    consistencyWarning,
    consistencyCode,
    consistencyDetail,
    scoreStats,
    scoreDistribution,
    questionAnalytics,
    examCodeComparison,
    reviewWorkload,
  };
}
