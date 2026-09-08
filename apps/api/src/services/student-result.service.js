import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

export async function listStudentResults(userId) {
  const student = await prisma.student.findUnique({
    where: { userId },
  });

  if (!student) {
    throw new AppError(
      "Tài khoản học sinh chưa được liên kết với hồ sơ học sinh.",
      404,
      "STUDENT_PROFILE_NOT_FOUND"
    );
  }

  const candidateRecords = await prisma.examCandidate.findMany({
    where: { studentId: student.id },
    include: {
      exam: {
        include: {
          subject: { select: { code: true, name: true } },
          class: { select: { id: true, name: true } },
        },
      },
    },
  });

  const publishedCandidates = candidateRecords.filter(
    (c) => c.exam && c.exam.resultsPublishedAt !== null
  );

  const results = [];

  for (const c of publishedCandidates) {
    const submissions = await prisma.examSubmission.findMany({
      where: {
        examId: c.examId,
        resolvedStudentNumber: c.studentNumber,
        status: "FINAL",
        identityNeedsReview: false,
      },
      select: {
        id: true,
        finalScore: true,
        maxScoreSnapshot: true,
        correctCount: true,
        incorrectCount: true,
        blankCount: true,
        questionCountSnapshot: true,
        examCodeSnapshot: true,
        finalizedAt: true,
        createdAt: true,
      },
    });

    if (submissions.length === 1) {
      const sub = submissions[0];
      results.push({
        examId: c.exam.id,
        examTitle: c.exam.title,
        subject: c.exam.subject,
        className: c.exam.class?.name || null,
        examDate: c.exam.publishedAt || c.exam.createdAt,
        publishedAt: c.exam.resultsPublishedAt,
        studentNumber: c.studentNumber,
        examCode: sub.examCodeSnapshot,
        score: sub.finalScore !== null ? Number(sub.finalScore) : 0,
        maxScore: sub.maxScoreSnapshot !== null ? Number(sub.maxScoreSnapshot) : 10,
        correctCount: sub.correctCount,
        incorrectCount: sub.incorrectCount,
        blankCount: sub.blankCount,
        questionCount: sub.questionCountSnapshot,
      });
    } else if (submissions.length > 1) {
      console.warn(`[STUDENT_RESULT] Conflict: Multiple FINAL submissions for SBD ${c.studentNumber} in exam ${c.examId}`);
    }
  }

  results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return results;
}

export async function getStudentResultDetail(userId, examId) {
  const student = await prisma.student.findUnique({
    where: { userId },
  });

  if (!student) {
    throw new AppError(
      "Tài khoản học sinh chưa được liên kết với hồ sơ học sinh.",
      404,
      "STUDENT_PROFILE_NOT_FOUND"
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      subject: { select: { code: true, name: true } },
      class: { select: { id: true, name: true } },
    },
  });

  if (!exam || !exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả chưa được công bố hoặc không tồn tại.",
      404,
      "STUDENT_RESULT_NOT_AVAILABLE"
    );
  }

  const candidate = await prisma.examCandidate.findUnique({
    where: {
      examId_studentId: {
        examId,
        studentId: student.id,
      },
    },
  });

  if (!candidate) {
    throw new AppError(
      "Kết quả chưa được công bố hoặc không tồn tại.",
      404,
      "STUDENT_RESULT_NOT_AVAILABLE"
    );
  }

  const submissions = await prisma.examSubmission.findMany({
    where: {
      examId,
      resolvedStudentNumber: candidate.studentNumber,
      status: "FINAL",
      identityNeedsReview: false,
    },
    include: {
      answers: {
        orderBy: { questionNumber: "asc" },
        select: {
          questionNumber: true,
          effectiveAnswer: true,
          result: true,
          scoreEarned: true,
        },
      },
    },
  });

  if (submissions.length === 0) {
    throw new AppError(
      "Kết quả chưa được công bố hoặc không tồn tại.",
      404,
      "STUDENT_RESULT_NOT_AVAILABLE"
    );
  }

  if (submissions.length > 1) {
    throw new AppError(
      "Không thể xác định duy nhất kết quả của bạn. Vui lòng liên hệ giáo viên.",
      409,
      "RESULT_IDENTITY_CONFLICT"
    );
  }

  const sub = submissions[0];

  return {
    examId: exam.id,
    examTitle: exam.title,
    subject: exam.subject,
    className: exam.class?.name || null,
    studentNumber: candidate.studentNumber,
    studentName: student.fullName,
    studentCode: student.studentCode,
    examCode: sub.examCodeSnapshot,
    score: sub.finalScore !== null ? Number(sub.finalScore) : 0,
    maxScore: sub.maxScoreSnapshot !== null ? Number(sub.maxScoreSnapshot) : 10,
    correctCount: sub.correctCount,
    incorrectCount: sub.incorrectCount,
    blankCount: sub.blankCount,
    questionCount: sub.questionCountSnapshot,
    publishedAt: exam.resultsPublishedAt,
    allowStudentViewAnswers: exam.allowStudentViewAnswers,
    answers: exam.allowStudentViewAnswers
      ? sub.answers.map((a) => ({
          questionNumber: a.questionNumber,
          studentAnswer: a.effectiveAnswer,
          result: a.result,
          scoreEarned: a.scoreEarned !== null ? Number(a.scoreEarned) : 0,
        }))
      : null,
  };
}
