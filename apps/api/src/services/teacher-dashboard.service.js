import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

export async function getTeacherDashboard(teacherUserId) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherUserId },
  });

  if (!teacher) {
    throw new AppError("Không tìm thấy hồ sơ giáo viên.", 404, "TEACHER_NOT_FOUND");
  }

  const exams = await prisma.exam.findMany({
    where: { teacherId: teacher.id },
    include: {
      subject: { select: { code: true, name: true } },
      class: { select: { id: true, name: true } },
      submissions: {
        select: {
          id: true,
          status: true,
          identityNeedsReview: true,
          unresolvedCount: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalExams = exams.length;
  let activeExams = 0;
  let closedExams = 0;
  let draftExams = 0;
  let archivedExams = 0;
  let totalSubmissions = 0;
  let totalFinalSubmissions = 0;
  let totalProvisionalSubmissions = 0;

  const actionNeeded = [];

  for (const ex of exams) {
    if (ex.status === "PUBLISHED") activeExams++;
    else if (ex.status === "CLOSED") closedExams++;
    else if (ex.status === "DRAFT") draftExams++;
    else if (ex.status === "ARCHIVED") archivedExams++;

    const subCount = ex.submissions.length;
    const finalCount = ex.submissions.filter((s) => s.status === "FINAL").length;
    const provCount = ex.submissions.filter((s) => s.status === "PROVISIONAL").length;
    const identityReviewCount = ex.submissions.filter((s) => s.identityNeedsReview).length;

    totalSubmissions += subCount;
    totalFinalSubmissions += finalCount;
    totalProvisionalSubmissions += provCount;

    // Action needed items
    if (provCount > 0) {
      actionNeeded.push({
        examId: ex.id,
        examTitle: ex.title,
        className: ex.class?.name || null,
        type: "PENDING_REVIEW",
        count: provCount,
        message: `Còn ${provCount} bài thi cần duyệt kết quả.`,
      });
    }

    if (identityReviewCount > 0) {
      actionNeeded.push({
        examId: ex.id,
        examTitle: ex.title,
        className: ex.class?.name || null,
        type: "UNCONFIRMED_IDENTITY",
        count: identityReviewCount,
        message: `Còn ${identityReviewCount} bài thi chưa xác nhận số báo danh.`,
      });
    }

    if (ex.status === "CLOSED" && ex.resultsPublishedAt === null && finalCount > 0 && provCount === 0) {
      actionNeeded.push({
        examId: ex.id,
        examTitle: ex.title,
        className: ex.class?.name || null,
        type: "READY_TO_PUBLISH",
        count: finalCount,
        message: "Kỳ thi đã hoàn tất chấm bài, sẵn sàng công bố kết quả.",
      });
    }
  }

  const recentExams = exams.slice(0, 5).map((ex) => ({
    id: ex.id,
    title: ex.title,
    subject: ex.subject,
    className: ex.class?.name || null,
    status: ex.status,
    isPublished: ex.resultsPublishedAt !== null,
    publishedAt: ex.resultsPublishedAt,
    totalSubmissions: ex.submissions.length,
    finalSubmissions: ex.submissions.filter((s) => s.status === "FINAL").length,
    updatedAt: ex.updatedAt,
  }));

  return {
    summary: {
      totalExams,
      activeExams,
      closedExams,
      draftExams,
      archivedExams,
      totalSubmissions,
      totalFinalSubmissions,
      totalProvisionalSubmissions,
    },
    actionNeeded,
    recentExams,
  };
}
