import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

export async function getTeacherDashboard(teacherUserId, userRole = "TEACHER") {
  let where = {};

  if (userRole !== "SUPER_ADMIN") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacher) {
      throw new AppError("Không tìm thấy hồ sơ giáo viên.", 404, "TEACHER_NOT_FOUND");
    }
    where = { teacherId: teacher.id };
  }

  const exams = await prisma.exam.findMany({
    where,
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

export async function getTeacherTeachingAssignments(teacherUserId, userRole = "TEACHER") {
  if (userRole === "SUPER_ADMIN") {
    const [allClasses, allSubjects] = await Promise.all([
      prisma.class.findMany({
        select: { id: true, name: true, gradeId: true },
        orderBy: { name: "asc" },
      }),
      prisma.subject.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      isAdmin: true,
      hasAssignments: true,
      classes: allClasses,
      subjects: allSubjects,
      assignments: [],
    };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherUserId },
    include: {
      primarySubject: { select: { id: true, name: true, code: true } },
    },
  });

  if (!teacher) {
    throw new AppError("Không tìm thấy hồ sơ giáo viên.", 404, "TEACHER_NOT_FOUND");
  }

  const rawAssignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: teacher.id },
    include: {
      class: { select: { id: true, name: true, gradeId: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ class: { name: "asc" } }],
  });

  if (rawAssignments.length > 0) {
    const uniqueClassesMap = new Map();
    const uniqueSubjectsMap = new Map();

    for (const a of rawAssignments) {
      if (a.class) uniqueClassesMap.set(a.class.id, a.class);
      if (a.subject) uniqueSubjectsMap.set(a.subject.id, a.subject);
    }

    return {
      isAdmin: false,
      hasAssignments: true,
      teacherCode: teacher.teacherCode,
      fullName: teacher.fullName,
      title: teacher.title || "Giáo viên",
      primarySubject: teacher.primarySubject || null,
      classes: Array.from(uniqueClassesMap.values()),
      subjects: Array.from(uniqueSubjectsMap.values()),
      assignments: rawAssignments.map((a) => ({
        classId: a.classId,
        subjectId: a.subjectId,
        className: a.class?.name,
        subjectName: a.subject?.name,
      })),
    };
  }

  // Fallback nếu trường chưa kịp phân công trên hệ thống
  const [allClasses, allSubjects] = await Promise.all([
    prisma.class.findMany({
      select: { id: true, name: true, gradeId: true },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    isAdmin: false,
    hasAssignments: false,
    classes: allClasses,
    subjects: allSubjects,
    assignments: [],
  };
}

/**
 * Thống kê chuyên biệt cho Giáo viên (chỉ các lớp phụ trách) & Tổ trưởng (môn của tổ)
 */
export async function getTeacherClassStatistics(teacherUserId, { classId } = {}) {
  let teacher = await prisma.teacher.findUnique({
    where: { userId: teacherUserId },
    include: {
      primarySubject: { select: { id: true, name: true, code: true } },
    },
  });

  if (!teacher) {
    // Fallback if accessed by Super Admin or testing account
    teacher = await prisma.teacher.findFirst({
      include: {
        primarySubject: { select: { id: true, name: true, code: true } },
      },
    });
  }

  if (!teacher) {
    throw new AppError("Không tìm thấy hồ sơ giáo viên.", 404, "TEACHER_NOT_FOUND");
  }

  // Danh sách các lớp được phân công — truy vấn chuẩn 100% khớp với /classes
  const assignedClassesRaw = await prisma.class.findMany({
    where: {
      assignments: {
        some: {
          teacherId: teacher.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      gradeId: true,
      grade: {
        select: {
          id: true,
          level: true,
          name: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          exams: true,
        },
      },
      assignments: {
        where: { teacherId: teacher.id },
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: [
      { grade: { level: "asc" } },
      { name: "asc" },
    ],
  });

  const assignedClasses = assignedClassesRaw.map((cls) => {
    const subjects = (cls.assignments || [])
      .map((a) => a.subject?.name)
      .filter(Boolean);
    return {
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.grade?.level,
      gradeName: cls.grade?.name,
      studentCount: cls._count?.enrollments || 0,
      subjectName: subjects.join(", ") || teacher.primarySubject?.name || "Bộ môn",
    };
  });

  // Lớp đang chọn (mặc định "ALL" nếu nhiều lớp, hoặc chọn lớp cụ thể)
  const activeClassId = classId && classId !== "ALL" ? classId : null;
  const targetClassIds = activeClassId
    ? [activeClassId]
    : assignedClasses.map((c) => c.id);

  // Tổng học sinh của các lớp phụ trách
  const totalStudents = activeClassId
    ? assignedClasses.find((c) => c.id === activeClassId)?.studentCount || 0
    : assignedClasses.reduce((sum, c) => sum + c.studentCount, 0);

  // Lấy các bài thi thuộc phạm vi giáo viên này (tạo bởi giáo viên hoặc gán cho lớp)
  const whereExam = {
    OR: [
      { teacherId: teacher.id },
      ...(targetClassIds.length > 0
        ? [
            { classId: { in: targetClassIds } },
            { examClasses: { some: { classId: { in: targetClassIds } } } },
          ]
        : []),
    ],
  };

  const exams = await prisma.exam.findMany({
    where: whereExam,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true } },
      examClasses: {
        include: {
          class: { select: { id: true, name: true } },
        },
      },
      submissions: {
        select: {
          id: true,
          status: true,
          finalScore: true,
          provisionalScore: true,
          identityNeedsReview: true,
          unresolvedCount: true,
        },
      },
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Tính toán phổ điểm & điểm trung bình của lớp phụ trách
  let totalScoreSum = 0;
  let totalGradedCount = 0;
  let totalPendingReview = 0;
  let passCount = 0;
  const scoreDistribution = {
    excellent: 0, // >= 8.0
    good: 0,      // 6.5 - 7.9
    average: 0,   // 5.0 - 6.4
    belowAvg: 0,  // < 5.0
  };

  for (const ex of exams) {
    for (const sub of ex.submissions) {
      if (sub.identityNeedsReview || sub.status === "PROVISIONAL" || (sub.unresolvedCount && sub.unresolvedCount > 0)) {
        totalPendingReview++;
      }

      const score =
        sub.status === "FINAL" && sub.finalScore !== null
          ? Number(sub.finalScore)
          : sub.provisionalScore !== null
          ? Number(sub.provisionalScore)
          : null;

      if (score !== null && !isNaN(score)) {
        totalScoreSum += score;
        totalGradedCount++;

        if (score >= 8.0) scoreDistribution.excellent++;
        else if (score >= 6.5) scoreDistribution.good++;
        else if (score >= 5.0) scoreDistribution.average++;
        else scoreDistribution.belowAvg++;

        if (score >= 5.0) passCount++;
      }
    }
  }

  const averageScore =
    totalGradedCount > 0 ? Math.round((totalScoreSum / totalGradedCount) * 10) / 10 : null;
  const passRate =
    totalGradedCount > 0 ? Math.round((passCount / totalGradedCount) * 100) : 0;

  // Nếu là tổ trưởng chuyên môn: Lấy thêm thống kê của tổ bộ môn toàn trường
  let subjectLeaderData = null;
  if (teacher.isSubjectLeader && teacher.primarySubjectId) {
    const leaderSubjectId = teacher.primarySubjectId;
    const subjectExams = await prisma.exam.findMany({
      where: { subjectId: leaderSubjectId },
      include: {
        class: { select: { id: true, name: true, grade: { select: { level: true } } } },
        examClasses: {
          include: {
            class: { select: { id: true, name: true, grade: { select: { level: true } } } },
          },
        },
        submissions: {
          select: {
            finalScore: true,
            provisionalScore: true,
            status: true,
          },
        },
      },
    });

    let sScoreSum = 0;
    let sGradedCount = 0;
    const classScoreMap = new Map();

    for (const ex of subjectExams) {
      const classNames = [];
      if (ex.class?.name) classNames.push(ex.class.name);
      for (const ec of ex.examClasses || []) {
        if (ec.class?.name && !classNames.includes(ec.class.name)) {
          classNames.push(ec.class.name);
        }
      }
      const targetName = classNames.join(", ") || "Lớp chung";

      if (!classScoreMap.has(targetName)) {
        classScoreMap.set(targetName, { className: targetName, scoreSum: 0, count: 0 });
      }
      const cItem = classScoreMap.get(targetName);

      for (const sub of ex.submissions) {
        const sc =
          sub.status === "FINAL" && sub.finalScore !== null
            ? Number(sub.finalScore)
            : sub.provisionalScore !== null
            ? Number(sub.provisionalScore)
            : null;
        if (sc !== null && !isNaN(sc)) {
          sScoreSum += sc;
          sGradedCount++;
          cItem.scoreSum += sc;
          cItem.count++;
        }
      }
    }

    const classesComparison = Array.from(classScoreMap.values()).map((c) => ({
      className: c.className,
      gradedCount: c.count,
      averageScore: c.count > 0 ? Math.round((c.scoreSum / c.count) * 10) / 10 : null,
    }));

    subjectLeaderData = {
      subjectName: teacher.primarySubject?.name || "Bộ môn",
      totalSubjectExams: subjectExams.length,
      totalGradedSubmissions: sGradedCount,
      schoolWideAverageScore:
        sGradedCount > 0 ? Math.round((sScoreSum / sGradedCount) * 10) / 10 : null,
      classesComparison,
    };
  }

  return {
    teacherInfo: {
      fullName: teacher.fullName,
      teacherCode: teacher.teacherCode,
      isSubjectLeader: Boolean(teacher.isSubjectLeader),
      primarySubjectName: teacher.primarySubject?.name || null,
    },
    assignedClasses,
    selectedClassId: activeClassId || "ALL",
    stats: {
      assignedClassCount: assignedClasses.length,
      totalStudents,
      totalExams: exams.length,
      totalGradedSubmissions: totalGradedCount,
      pendingReviewCount: totalPendingReview,
      averageScore,
      passRate,
      scoreDistribution,
    },
    exams: exams.map((ex) => {
      const exGraded = ex.submissions.filter(
        (s) => s.finalScore !== null || s.provisionalScore !== null
      );
      const exSum = exGraded.reduce(
        (acc, s) => acc + Number(s.finalScore ?? s.provisionalScore ?? 0),
        0
      );
      const exClasses = [];
      if (ex.class?.name) exClasses.push(ex.class.name);
      for (const ec of ex.examClasses || []) {
        if (ec.class?.name && !exClasses.includes(ec.class.name)) {
          exClasses.push(ec.class.name);
        }
      }
      return {
        id: ex.id,
        title: ex.title,
        examType: ex.examType,
        subjectName: ex.subject?.name || "N/A",
        className: exClasses.join(", ") || ex.class?.name || "Chưa gán",
        submissionsCount: ex.submissions.length,
        averageScore:
          exGraded.length > 0 ? Math.round((exSum / exGraded.length) * 10) / 10 : null,
        pendingReviewCount: ex.submissions.filter(
          (s) => s.identityNeedsReview || s.status === "PROVISIONAL"
        ).length,
        status: ex.status,
        createdAt: ex.createdAt,
      };
    }),
    subjectLeaderData,
  };
}
