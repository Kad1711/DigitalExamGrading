import prisma from "../config/prisma.js";

/**
 * Get aggregated system statistics for Admin Dashboard with dynamic filters
 * @param {Object} filters - { gradeId, classId, subjectId, teacherId }
 */
export async function getAdminSystemDashboard(filters = {}, user = null) {
  const { gradeId, classId, subjectId, teacherId } = filters;

  const isTeacher = user?.role === "TEACHER";
  let teacherProfile = null;
  let isSubjectLeader = false;
  let leaderSubjectId = null;
  let assignedClassIds = [];

  if (isTeacher && user?.id) {
    teacherProfile = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        primarySubject: { select: { id: true, name: true, code: true } },
        assignments: {
          select: { classId: true, subjectId: true },
        },
      },
    });

    if (teacherProfile) {
      isSubjectLeader = teacherProfile.isSubjectLeader === true && !!teacherProfile.primarySubjectId;
      leaderSubjectId = teacherProfile.primarySubjectId;
      assignedClassIds = (teacherProfile.assignments || []).map((a) => a.classId).filter(Boolean);
    }
  }

  // Build exam filter
  const whereExam = {};
  const whereClass = {};
  const whereStudent = {};
  const whereSubmission = {};

  if (isTeacher && isSubjectLeader && leaderSubjectId) {
    // 1. TỔ TRƯỞNG CHUYÊN MÔN: Xem thống kê toàn trường của môn mình làm tổ trưởng
    const targetSubjectId = leaderSubjectId;
    whereExam.subjectId = targetSubjectId;

    if (gradeId && gradeId !== "ALL") whereExam.gradeId = gradeId;
    if (classId && classId !== "ALL") {
      whereExam.OR = [{ classId }, { examClasses: { some: { classId } } }];
      whereClass.id = classId;
      whereStudent.enrollments = { some: { classId } };
    } else if (gradeId && gradeId !== "ALL") {
      whereClass.gradeId = gradeId;
      whereStudent.enrollments = { some: { class: { gradeId } } };
    }
    if (teacherId && teacherId !== "ALL") whereExam.teacherId = teacherId;

    whereSubmission.exam = whereExam;
  } else if (isTeacher) {
    // 2. GIÁO VIÊN THƯỜNG: Chỉ xem thống kê của các lớp mình phụ trách giảng dạy
    const scopedClassIds = assignedClassIds.length > 0 ? assignedClassIds : ["__no_class__"];

    if (classId && classId !== "ALL" && scopedClassIds.includes(classId)) {
      whereExam.OR = [{ classId }, { examClasses: { some: { classId } } }];
      whereClass.id = classId;
      whereStudent.enrollments = { some: { classId } };
      whereSubmission.student = { enrollments: { some: { classId } } };
    } else {
      whereExam.OR = [
        { classId: { in: scopedClassIds } },
        { examClasses: { some: { classId: { in: scopedClassIds } } } },
        { teacherId: teacherProfile ? teacherProfile.id : "__none__" },
      ];
      whereClass.id = { in: scopedClassIds };
      whereStudent.enrollments = { some: { classId: { in: scopedClassIds } } };
      whereSubmission.student = { enrollments: { some: { classId: { in: scopedClassIds } } } };
    }

    if (subjectId && subjectId !== "ALL") whereExam.subjectId = subjectId;
    if (gradeId && gradeId !== "ALL") {
      whereExam.gradeId = gradeId;
      whereClass.gradeId = gradeId;
    }

    whereSubmission.exam = whereExam;
  } else {
    // 3. BAN GIÁM HIỆU / ADMIN: Xem toàn trường
    if (subjectId && subjectId !== "ALL") whereExam.subjectId = subjectId;
    if (gradeId && gradeId !== "ALL") whereExam.gradeId = gradeId;
    if (classId && classId !== "ALL") {
      whereExam.OR = [{ classId }, { examClasses: { some: { classId } } }];
      whereClass.id = classId;
      whereSubmission.student = { enrollments: { some: { classId } } };
      whereStudent.enrollments = { some: { classId } };
    } else if (gradeId && gradeId !== "ALL") {
      whereClass.gradeId = gradeId;
      whereSubmission.student = { enrollments: { some: { class: { gradeId } } } };
      whereStudent.enrollments = { some: { class: { gradeId } } };
    }
    if (teacherId && teacherId !== "ALL") whereExam.teacherId = teacherId;

    if (Object.keys(whereExam).length > 0) {
      whereSubmission.exam = whereExam;
    }
  }

  // Ensure total student count only reflects enrolled students in classes
  if (!whereStudent.enrollments) {
    whereStudent.enrollments = { some: {} };
  }

  const [
    filterGrades,
    filterClasses,
    filterSubjects,
    filterTeachers,
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
    // Filter dropdown options
    prisma.grade.findMany({
      where: isTeacher && !isSubjectLeader
        ? { classes: { some: { id: { in: assignedClassIds.length > 0 ? assignedClassIds : ["__none__"] } } } }
        : {},
      orderBy: { level: "asc" },
      select: { id: true, name: true, level: true },
    }),
    prisma.class.findMany({
      where: isTeacher && !isSubjectLeader
        ? { id: { in: assignedClassIds.length > 0 ? assignedClassIds : ["__none__"] } }
        : isTeacher && isSubjectLeader
        ? { assignments: { some: { subjectId: leaderSubjectId } } }
        : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, gradeId: true },
    }),
    prisma.subject.findMany({
      where: isTeacher && isSubjectLeader
        ? { id: leaderSubjectId }
        : isTeacher && !isSubjectLeader
        ? {
            OR: [
              { assignments: { some: { teacherId: teacherProfile?.id || "__none__" } } },
              { id: teacherProfile?.primarySubjectId || "__none__" },
            ],
          }
        : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.teacher.findMany({
      where: isTeacher && !isSubjectLeader
        ? { id: teacherProfile?.id || "__none__" }
        : isTeacher && isSubjectLeader
        ? {
            OR: [
              { primarySubjectId: leaderSubjectId },
              { assignments: { some: { subjectId: leaderSubjectId } } },
            ],
          }
        : {},
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, teacherCode: true },
    }),

    // Teachers
    isTeacher && !isSubjectLeader
      ? 1
      : isTeacher && isSubjectLeader
      ? prisma.teacher.count({
          where: {
            OR: [
              { primarySubjectId: leaderSubjectId },
              { assignments: { some: { subjectId: leaderSubjectId } } },
            ],
          },
        })
      : prisma.teacher.count(),
    isTeacher && !isSubjectLeader
      ? (teacherProfile ? 1 : 0)
      : isTeacher && isSubjectLeader
      ? prisma.user.count({
          where: {
            role: "TEACHER",
            status: "ACTIVE",
            teacher: {
              OR: [
                { primarySubjectId: leaderSubjectId },
                { assignments: { some: { subjectId: leaderSubjectId } } },
              ],
            },
          },
        })
      : prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
    isTeacher && !isSubjectLeader
      ? 0
      : isTeacher && isSubjectLeader
      ? prisma.user.count({
          where: {
            role: "TEACHER",
            status: "LOCKED",
            teacher: {
              OR: [
                { primarySubjectId: leaderSubjectId },
                { assignments: { some: { subjectId: leaderSubjectId } } },
              ],
            },
          },
        })
      : prisma.user.count({ where: { role: "TEACHER", status: "LOCKED" } }),

    // Students: Đã được xếp lớp (tuân thủ bộ lọc)
    prisma.student.count({
      where: whereStudent,
    }),
    prisma.studentEnrollment.count({
      where:
        classId && classId !== "ALL"
          ? { classId }
          : gradeId && gradeId !== "ALL"
          ? { class: { gradeId } }
          : {},
    }),

    // Classes
    prisma.class.count({ where: whereClass }),
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

    // Exams (Filtered)
    prisma.exam.count({ where: whereExam }),
    prisma.exam.groupBy({
      by: ["status"],
      where: whereExam,
      _count: { id: true },
    }),
    prisma.exam.count({
      where: { ...whereExam, resultsPublishedAt: { not: null } },
    }),

    // Submissions (Filtered)
    prisma.examSubmission.count({ where: whereSubmission }),
    prisma.examSubmission.groupBy({
      by: ["status"],
      where: whereSubmission,
      _count: { id: true },
    }),
    prisma.examSubmission.count({
      where: { ...whereSubmission, identityNeedsReview: true },
    }),

    // Answers aggregation (Filtered)
    prisma.examSubmission.aggregate({
      where: whereSubmission,
      _sum: {
        correctCount: true,
        incorrectCount: true,
        blankCount: true,
        unresolvedCount: true,
      },
    }),

    // Submissions score list for distribution and average (Filtered)
    prisma.examSubmission.findMany({
      where: whereSubmission,
      select: {
        finalScore: true,
        provisionalScore: true,
        status: true,
      },
    }),

    // Recent exams (Filtered)
    prisma.exam.findMany({
      where: whereExam,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { fullName: true, teacherCode: true } },
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
    }),

    // Recent submissions (Filtered)
    prisma.examSubmission.findMany({
      where: whereSubmission,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        exam: { select: { id: true, title: true } },
        examCode: { select: { code: true } },
      },
    }),

    // Top active teachers
    isTeacher && !isSubjectLeader
      ? (teacherProfile
          ? prisma.teacher.findMany({
              where: { id: teacherProfile.id },
              include: {
                user: { select: { email: true, status: true } },
                _count: { select: { exams: true } },
              },
            })
          : Promise.resolve([]))
      : isTeacher && isSubjectLeader
      ? prisma.teacher.findMany({
          where: {
            OR: [
              { primarySubjectId: leaderSubjectId },
              { assignments: { some: { subjectId: leaderSubjectId } } },
            ],
          },
          take: 5,
          include: {
            user: { select: { email: true, status: true } },
            _count: { select: { exams: true } },
          },
          orderBy: { exams: { _count: "desc" } },
        })
      : prisma.teacher.findMany({
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
    const rawVal =
      sub.status === "FINAL" && sub.finalScore !== null
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

  const averageScore =
    scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;

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
    examPercentage:
      totalExams > 0
        ? Number(((s._count.exams / totalExams) * 100).toFixed(1))
        : 0,
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
    filterOptions: {
      grades: filterGrades,
      classes: filterClasses,
      subjects: filterSubjects,
      teachers: filterTeachers,
    },
    appliedFilters: {
      gradeId: gradeId || "ALL",
      classId: classId || "ALL",
      subjectId: subjectId || "ALL",
      teacherId: teacherId || "ALL",
    },
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
      studentNumber:
        s.resolvedStudentNumber ||
        s.candidateStudentNumber ||
        s.detectedStudentNumber ||
        "---",
      status: s.status,
      score:
        s.status === "FINAL" && s.finalScore !== null
          ? Number(s.finalScore)
          : s.provisionalScore !== null
          ? Number(s.provisionalScore)
          : null,
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
    systemHealth: isTeacher
      ? null
      : {
          status: "HEALTHY",
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          dbStatus: "CONNECTED",
        },
    scopeInfo: {
      isTeacher,
      isSubjectLeader,
      subjectName: teacherProfile?.primarySubject?.name || null,
      assignedClassCount: assignedClassIds.length,
      teacherFullName: teacherProfile?.fullName || user?.fullName || null,
    },
  };
}
