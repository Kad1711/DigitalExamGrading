import prisma from "../config/prisma.js";

/**
 * Get aggregated system statistics for Admin Dashboard
 */
export async function getAdminSystemDashboard() {
  const [
    totalTeachers,
    activeTeachers,
    lockedTeachers,
    totalStudents,
    totalEnrollments,
    totalClasses,
    currentAcademicYear,
    allGrades,
    allSubjects,
    totalExams,
    examsByStatusRaw,
    resultsPublishedExamsCount,
    totalSubmissions,
    submissionsByStatusRaw,
    identityNeedsReviewCount,
    submissionAnswersAgg,
    submissionsScores,
    recentExamsRaw,
    recentSubmissionsRaw,
    topTeachersRaw,
  ] = await Promise.all([
    // Teachers
    prisma.teacher.count(),
    prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "TEACHER", status: "LOCKED" } }),

    // Students
    prisma.student.count(),
    prisma.studentEnrollment.count(),

    // Classes
    prisma.class.count(),
    prisma.academicYear.findFirst({ orderBy: { createdAt: "desc" } }),

    // Grades with classes and student counts
    prisma.grade.findMany({
      orderBy: { level: "asc" },
      include: {
        classes: {
          include: {
            _count: {
              select: { enrollments: true },
            },
          },
        },
      },
    }),

    // Subjects with exam counts
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: { exams: true },
        },
      },
    }),

    // Exams
    prisma.exam.count(),
    prisma.exam.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.exam.count({
      where: { resultsPublishedAt: { not: null } },
    }),

    // Submissions
    prisma.examSubmission.count(),
    prisma.examSubmission.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.examSubmission.count({
      where: { identityNeedsReview: true },
    }),

    // Answers aggregation
    prisma.examSubmission.aggregate({
      _sum: {
        correctCount: true,
        incorrectCount: true,
        blankCount: true,
        unresolvedCount: true,
      },
    }),

    // Submissions score list for distribution and average
    prisma.examSubmission.findMany({
      select: {
        finalScore: true,
        provisionalScore: true,
        status: true,
      },
    }),

    // Recent exams
    prisma.exam.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { fullName: true, teacherCode: true } },
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
    }),

    // Recent submissions
    prisma.examSubmission.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        exam: { select: { id: true, title: true } },
        examCode: { select: { code: true } },
      },
    }),

    // Top active teachers
    prisma.teacher.findMany({
      take: 5,
      include: {
        user: { select: { email: true, status: true } },
        _count: { select: { exams: true } },
      },
      orderBy: {
        exams: { _count: "desc" },
      },
    }),
  ]);

  // Format Exams by status
  const examStatusMap = {
    DRAFT: 0,
    PUBLISHED: 0,
    CLOSED: 0,
    ARCHIVED: 0,
  };
  for (const item of examsByStatusRaw) {
    if (examStatusMap[item.status] !== undefined) {
      examStatusMap[item.status] = item._count.id;
    }
  }

  // Format Submissions by status
  const submissionStatusMap = {
    PROVISIONAL: 0,
    FINAL: 0,
  };
  for (const item of submissionsByStatusRaw) {
    if (submissionStatusMap[item.status] !== undefined) {
      submissionStatusMap[item.status] = item._count.id;
    }
  }

  // Calculate score distribution & average
  let scoreSum = 0;
  let scoreCount = 0;
  const scoreDistribution = {
    excellent: 0, // 8.0 - 10
    good: 0,      // 6.5 - 7.99
    average: 0,   // 5.0 - 6.49
    belowAvg: 0,  // < 5.0
  };

  for (const sub of submissionsScores) {
    const rawVal = sub.status === "FINAL" && sub.finalScore !== null
      ? sub.finalScore
      : sub.provisionalScore;

    if (rawVal !== null && rawVal !== undefined) {
      const score = Number(rawVal);
      if (!isNaN(score)) {
        scoreSum += score;
        scoreCount += 1;

        if (score >= 8.0) scoreDistribution.excellent += 1;
        else if (score >= 6.5) scoreDistribution.good += 1;
        else if (score >= 5.0) scoreDistribution.average += 1;
        else scoreDistribution.belowAvg += 1;
      }
    }
  }

  const averageScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;

  // Grade level breakdown (THCS: 6-9, THPT: 10-12)
  const gradeBreakdown = allGrades.map((g) => {
    const classesCount = g.classes.length;
    const studentsCount = g.classes.reduce(
      (acc, c) => acc + (c._count?.enrollments || 0),
      0
    );
    const tier = g.level <= 9 ? "THCS" : "THPT";
    return {
      gradeId: g.id,
      level: g.level,
      name: g.name,
      tier,
      classesCount,
      studentsCount,
    };
  });

  const thcsStudents = gradeBreakdown
    .filter((g) => g.tier === "THCS")
    .reduce((acc, g) => acc + g.studentsCount, 0);
  const thptStudents = gradeBreakdown
    .filter((g) => g.tier === "THPT")
    .reduce((acc, g) => acc + g.studentsCount, 0);

  const thcsClasses = gradeBreakdown
    .filter((g) => g.tier === "THCS")
    .reduce((acc, g) => acc + g.classesCount, 0);
  const thptClasses = gradeBreakdown
    .filter((g) => g.tier === "THPT")
    .reduce((acc, g) => acc + g.classesCount, 0);

  // Subject breakdown (with % of exams)
  const subjectsBreakdown = allSubjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    examsCount: s._count.exams,
    examPercentage: totalExams > 0 ? Number(((s._count.exams / totalExams) * 100).toFixed(1)) : 0,
  }));

  // OMR Answer Stats
  const omrAnswers = {
    correct: submissionAnswersAgg._sum.correctCount || 0,
    incorrect: submissionAnswersAgg._sum.incorrectCount || 0,
    blank: submissionAnswersAgg._sum.blankCount || 0,
    unresolved: submissionAnswersAgg._sum.unresolvedCount || 0,
  };
  const totalOmrAnswers =
    omrAnswers.correct +
    omrAnswers.incorrect +
    omrAnswers.blank +
    omrAnswers.unresolved;

  return {
    overview: {
      teachers: {
        total: totalTeachers,
        active: activeTeachers,
        locked: lockedTeachers,
      },
      students: {
        total: totalStudents,
        enrolled: totalEnrollments,
      },
      classes: {
        total: totalClasses,
        thcs: thcsClasses,
        thpt: thptClasses,
      },
      academicYear: currentAcademicYear?.name || "2026-2027",
      exams: {
        total: totalExams,
        draft: examStatusMap.DRAFT,
        published: examStatusMap.PUBLISHED,
        closed: examStatusMap.CLOSED,
        archived: examStatusMap.ARCHIVED,
        resultsPublished: resultsPublishedExamsCount,
      },
      submissions: {
        total: totalSubmissions,
        final: submissionStatusMap.FINAL,
        provisional: submissionStatusMap.PROVISIONAL,
        needsReview: identityNeedsReviewCount,
      },
      scoring: {
        averageScore,
        gradedCount: scoreCount,
        distribution: scoreDistribution,
      },
    },
    tierStats: {
      thcs: { students: thcsStudents, classes: thcsClasses },
      thpt: { students: thptStudents, classes: thptClasses },
    },
    grades: gradeBreakdown,
    subjects: subjectsBreakdown,
    omrStats: {
      ...omrAnswers,
      total: totalOmrAnswers,
    },
    recentExams: recentExamsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      subjectName: e.subject?.name || "Chưa xác định",
      className: e.class?.name || "Chưa gán",
      teacherName: e.teacher?.fullName || "Chưa xác định",
      teacherCode: e.teacher?.teacherCode || "",
      status: e.status,
      submissionsCount: e._count.submissions,
      createdAt: e.createdAt,
    })),
    recentSubmissions: recentSubmissionsRaw.map((s) => ({
      id: s.id,
      examId: s.exam?.id,
      examTitle: s.exam?.title || "Kỳ thi",
      examCode: s.examCode?.code || "N/A",
      studentNumber: s.resolvedStudentNumber || s.candidateStudentNumber || s.detectedStudentNumber || "---",
      status: s.status,
      score: s.status === "FINAL" && s.finalScore !== null ? Number(s.finalScore) : (s.provisionalScore !== null ? Number(s.provisionalScore) : null),
      createdAt: s.createdAt,
    })),
    topTeachers: topTeachersRaw.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      teacherCode: t.teacherCode,
      email: t.user?.email,
      status: t.user?.status,
      examsCount: t._count.exams,
    })),
    systemHealth: {
      status: "HEALTHY",
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      dbStatus: "CONNECTED",
    },
  };
}
