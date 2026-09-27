import prisma from "../config/prisma.js";

/**
 * Get aggregated system statistics for Admin Dashboard with dynamic filters
 * @param {Object} filters - { gradeId, classId, subjectId, teacherId }
 */
export async function getAdminSystemDashboard(filters = {}, user = null) {
  const { gradeId, classId, subjectId, teacherId } = filters;

  // 0. Fetch current academic year first
  const currentAcademicYear = await prisma.academicYear.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const currentYearId = currentAcademicYear?.id;
  const assignmentYearFilter = currentYearId ? { academicYearId: currentYearId } : {};

  const isTeacher = user?.role === "TEACHER";
  let teacherProfile = null;
  let isSubjectLeader = false;
  let leaderSubjectId = null;
  let assignedClassIds = [];
  let regularAssignments = [];
  let isForbiddenTeacherScope = false;

  if (isTeacher && user?.id) {
    teacherProfile = await prisma.teacher.findFirst({
      where: {
        OR: [{ userId: user.id }, { id: user.id }],
      },
      include: {
        primarySubject: { select: { id: true, name: true, code: true } },
        assignments: {
          where: assignmentYearFilter,
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

  // Permission policy: If authenticated as a regular teacher, they can only view their own scope.
  // If teacherId is passed and refers to another teacher, the intersection is empty (never return colleague's data).
  if (isTeacher && !isSubjectLeader) {
    if (teacherId && teacherId !== "ALL" && teacherProfile && teacherId !== teacherProfile.id) {
      isForbiddenTeacherScope = true;
    }
  }

  // Build query scopes
  const whereExam = {};
  const whereClass = {};
  if (currentYearId) {
    whereClass.academicYearId = currentYearId;
  }
  const whereStudent = {};
  const whereSubmission = {};
  const whereAssignment = {};
  if (currentYearId) {
    whereAssignment.academicYearId = currentYearId;
  }

  // 1. Resolve target teacher's assignments if teacherId filter is specified
  let targetTeacherClassIds = [];
  let targetTeacherSubjectIds = [];
  let targetTeacherPairs = [];
  if (teacherId && teacherId !== "ALL") {
    whereAssignment.teacherId = teacherId;
    const tAssignments = await prisma.teachingAssignment.findMany({
      where: {
        teacherId,
        ...(subjectId && subjectId !== "ALL" ? { subjectId } : {}),
        ...(classId && classId !== "ALL" ? { classId } : {}),
        ...(gradeId && gradeId !== "ALL" ? { class: { gradeId } } : {}),
        ...assignmentYearFilter,
      },
      select: { classId: true, subjectId: true },
    });
    targetTeacherPairs = tAssignments.map((a) => ({ classId: a.classId, subjectId: a.subjectId }));
    targetTeacherClassIds = [...new Set(tAssignments.map((a) => a.classId))];
    targetTeacherSubjectIds = [...new Set(tAssignments.map((a) => a.subjectId))];
  }

  // 2. Query conditions based on user role and filters
  if (isForbiddenTeacherScope) {
    whereExam.id = "__none__";
    whereSubmission.id = "__none__";
    whereClass.id = "__none__";
    whereStudent.id = "__none__";
    whereAssignment.id = "__none__";
  } else if (isTeacher && isSubjectLeader && leaderSubjectId) {
    // TỔ TRƯỞNG CHUYÊN MÔN: Xem thống kê toàn trường của môn mình làm tổ trưởng
    const targetSubjectId = leaderSubjectId;
    whereExam.subjectId = targetSubjectId;
    whereAssignment.subjectId = targetSubjectId;

    if (classId && classId !== "ALL") {
      whereExam.OR = [{ classId }, { examClasses: { some: { classId } } }];
      whereClass.id = classId;
      whereStudent.enrollments = { some: { classId, ...assignmentYearFilter } };
      whereAssignment.classId = classId;
    } else if (gradeId && gradeId !== "ALL") {
      whereExam.OR = [
        { gradeId },
        { class: { gradeId } },
        { examClasses: { some: { class: { gradeId } } } },
      ];
      whereClass.gradeId = gradeId;
      whereStudent.enrollments = { some: { class: { gradeId }, ...assignmentYearFilter } };
      whereAssignment.class = { gradeId };
    }

    if (teacherId && teacherId !== "ALL") {
      const teacherLeaderPairs = targetTeacherPairs.filter((p) => p.subjectId === targetSubjectId);
      if (teacherLeaderPairs.length === 0) {
        whereExam.id = "__none__";
      } else {
        const teacherExamCond = {
          OR: [
            { teacherId },
            ...teacherLeaderPairs.map((pair) => ({
              AND: [
                {
                  OR: [
                    { classId: pair.classId },
                    { examClasses: { some: { classId: pair.classId } } },
                  ],
                },
                { subjectId: targetSubjectId },
              ],
            })),
          ],
        };
        whereExam.AND = [teacherExamCond];
      }
    }
  } else if (isTeacher) {
    // GIÁO VIÊN THƯỜNG: Chỉ xem thống kê của các lớp và môn mình phụ trách giảng dạy (giữ đúng cặp lớp-môn)
    regularAssignments = (teacherProfile?.assignments || []).filter((a) => {
      if (classId && classId !== "ALL" && a.classId !== classId) return false;
      if (subjectId && subjectId !== "ALL" && a.subjectId !== subjectId) return false;
      return true;
    });
    const scopedClassIds = [...new Set(regularAssignments.map((a) => a.classId))];
    whereAssignment.teacherId = teacherProfile ? teacherProfile.id : "__none__";

    const regularPairConditions = regularAssignments.map((pair) => ({
      AND: [
        {
          OR: [
            { classId: pair.classId },
            { examClasses: { some: { classId: pair.classId } } },
          ],
        },
        { subjectId: pair.subjectId },
      ],
    }));

    whereExam.OR = [
      ...regularPairConditions,
      { teacherId: teacherProfile ? teacherProfile.id : "__none__" },
    ];
    whereClass.id = { in: scopedClassIds.length > 0 ? scopedClassIds : ["__none__"] };
    whereStudent.enrollments = { some: { classId: { in: scopedClassIds.length > 0 ? scopedClassIds : ["__none__"] }, ...assignmentYearFilter } };
    whereAssignment.classId = { in: scopedClassIds.length > 0 ? scopedClassIds : ["__none__"] };

    if (gradeId && gradeId !== "ALL") {
      const gradeCond = {
        OR: [
          { gradeId },
          { class: { gradeId } },
          { examClasses: { some: { class: { gradeId } } } },
        ],
      };
      if (whereExam.AND) {
        whereExam.AND.push(gradeCond);
      } else {
        whereExam.AND = [gradeCond];
      }
      whereClass.gradeId = gradeId;
      whereAssignment.class = { gradeId };
    }
  } else {
    // BAN GIÁM HIỆU / ADMIN / KHẢO THÍ: Toàn quyền lọc
    if (subjectId && subjectId !== "ALL") {
      whereExam.subjectId = subjectId;
      whereAssignment.subjectId = subjectId;
    }
    if (classId && classId !== "ALL") {
      whereExam.OR = [{ classId }, { examClasses: { some: { classId } } }];
      whereClass.id = classId;
      whereStudent.enrollments = { some: { classId, ...assignmentYearFilter } };
      whereAssignment.classId = classId;
    } else if (gradeId && gradeId !== "ALL") {
      whereExam.OR = [
        { gradeId },
        { class: { gradeId } },
        { examClasses: { some: { class: { gradeId } } } },
      ];
      whereClass.gradeId = gradeId;
      whereStudent.enrollments = { some: { class: { gradeId }, ...assignmentYearFilter } };
      whereAssignment.class = { gradeId };
    }

    if (teacherId && teacherId !== "ALL") {
      whereClass.id = { in: targetTeacherClassIds.length > 0 ? targetTeacherClassIds : ["__none__"] };
      const teacherExamCond = {
        OR: [
          { teacherId },
          ...targetTeacherPairs.map((pair) => ({
            AND: [
              {
                OR: [
                  { classId: pair.classId },
                  { examClasses: { some: { classId: pair.classId } } },
                ],
              },
              { subjectId: pair.subjectId },
            ],
          })),
        ],
      };
      if (whereExam.AND) {
        whereExam.AND.push(teacherExamCond);
      } else {
        whereExam.AND = [teacherExamCond];
      }
    }
  }

  // 3. Determine scoped classes for accurate submission disambiguation
  if (isForbiddenTeacherScope) {
    whereSubmission.id = "__none__";
  } else {
    let submissionScopedClassIds = null;
    if (classId && classId !== "ALL") {
      submissionScopedClassIds = [classId];
    } else if (teacherId && teacherId !== "ALL") {
      submissionScopedClassIds = targetTeacherClassIds;
    } else if (isTeacher && !isSubjectLeader) {
      submissionScopedClassIds = assignedClassIds;
    } else if (gradeId && gradeId !== "ALL") {
      const gradeClasses = await prisma.class.findMany({
        where: { gradeId, ...(currentYearId ? { academicYearId: currentYearId } : {}) },
        select: { id: true },
      });
      submissionScopedClassIds = gradeClasses.map((c) => c.id);
    }

    if (submissionScopedClassIds !== null) {
      if (submissionScopedClassIds.length === 0) {
        whereSubmission.id = "__none__";
      } else {
        // Find all exams matching whereExam first
        const candidateExams = await prisma.exam.findMany({
          where: whereExam,
          select: {
            id: true,
            teacherId: true,
            subjectId: true,
            classId: true,
            examClasses: { select: { classId: true } },
          },
        });

        if (candidateExams.length === 0) {
          whereSubmission.id = "__none__";
        } else {
          const submissionConditions = [];

          // Helper: determine allowed classes for a specific exam based on teacher's pair assignments
          const getScopedClassesForExam = (ex) => {
            const exClassIds = [
              ...(ex.classId ? [ex.classId] : []),
              ...(ex.examClasses ? ex.examClasses.map((ec) => ec.classId) : []),
            ];

            if (isTeacher && !isSubjectLeader) {
              const assignedForSubject = regularAssignments
                .filter((p) => p.subjectId === ex.subjectId)
                .map((p) => p.classId);

              // Intersect with classId filter if specified
              if (classId && classId !== "ALL") {
                return assignedForSubject.includes(classId) ? [classId] : [];
              }
              if (assignedForSubject.length > 0) {
                return assignedForSubject;
              }
              if (teacherProfile && ex.teacherId === teacherProfile.id) {
                if (classId && classId !== "ALL") {
                  return exClassIds.includes(classId) ? [classId] : [];
                }
                return exClassIds;
              }
              return [];
            }

            if (isTeacher && isSubjectLeader) {
              if (ex.subjectId !== leaderSubjectId) {
                return [];
              }
              if (teacherId && teacherId !== "ALL") {
                const assignedForSubject = targetTeacherPairs
                  .filter((p) => p.subjectId === ex.subjectId)
                  .map((p) => p.classId);
                if (classId && classId !== "ALL") {
                  return assignedForSubject.includes(classId) ? [classId] : [];
                }
                return assignedForSubject;
              }
              if (classId && classId !== "ALL") {
                return exClassIds.includes(classId) ? [classId] : [classId];
              }
              if (submissionScopedClassIds) {
                return submissionScopedClassIds;
              }
              return exClassIds;
            }

            // Admin / Principal / Vice-Principal / Exam Officer
            if (teacherId && teacherId !== "ALL") {
              const assignedForSubject = targetTeacherPairs
                .filter((p) => p.subjectId === ex.subjectId)
                .map((p) => p.classId);

              if (classId && classId !== "ALL") {
                if (assignedForSubject.includes(classId)) return [classId];
                if (ex.teacherId === teacherId && exClassIds.includes(classId)) return [classId];
                return [];
              }
              if (assignedForSubject.length > 0) {
                return assignedForSubject;
              }
              if (ex.teacherId === teacherId) {
                return exClassIds;
              }
              return [];
            }

            if (classId && classId !== "ALL") {
              return [classId];
            }
            if (submissionScopedClassIds) {
              return submissionScopedClassIds;
            }
            return exClassIds;
          };

        for (const ex of candidateExams) {
          const exScopedClasses = getScopedClassesForExam(ex);
          if (exScopedClasses.length === 0) {
            continue;
          }

          const exClassIds = [
            ...(ex.classId ? [ex.classId] : []),
            ...(ex.examClasses ? ex.examClasses.map((ec) => ec.classId) : []),
          ];

          // 1. Single-class dedicated exam (or unassigned exam) where its only class is in scope
          if (exClassIds.length <= 1 && (exClassIds.length === 0 || exScopedClasses.includes(exClassIds[0]))) {
            submissionConditions.push({ examId: ex.id });
            continue;
          }

          // 2. Multi-class exam: find students enrolled in the scoped classes for this exam's subject
          const enrolledStudents = await prisma.studentEnrollment.findMany({
            where: {
              classId: { in: exScopedClasses },
              ...assignmentYearFilter,
            },
            select: {
              studentId: true,
              student: { select: { studentCode: true } },
            },
          });
          const enrolledStudentIds = enrolledStudents.map((e) => e.studentId);
          const enrolledStudentCodes = enrolledStudents
            .map((e) => e.student?.studentCode?.trim())
            .filter(Boolean);

          // Authoritative candidates for this specific exam
          const examCandidates = await prisma.examCandidate.findMany({
            where: { examId: ex.id },
            select: { studentId: true, studentNumber: true },
          });

          let allowedSbdsForThisExam = [];
          if (examCandidates.length > 0) {
            // ExamCandidate exists: strictly authorize SBDs of students enrolled in this exam's scoped classes
            // DO NOT inject raw studentCodes from other students!
            allowedSbdsForThisExam = examCandidates
              .filter((c) => enrolledStudentIds.includes(c.studentId) && c.studentNumber)
              .map((c) => c.studentNumber.trim());
          } else {
            // Only if this exam has ZERO candidate records (ad-hoc scan without roster), fallback to studentCode
            allowedSbdsForThisExam = enrolledStudentCodes;
          }

          if (allowedSbdsForThisExam.length > 0) {
            // 1. Authoritative verified SBD match
            submissionConditions.push({
              examId: ex.id,
              resolvedStudentNumber: { in: allowedSbdsForThisExam },
            });

            // 2. Unverified tentative match (only when resolvedStudentNumber is null or empty)
            submissionConditions.push({
              examId: ex.id,
              OR: [{ resolvedStudentNumber: null }, { resolvedStudentNumber: "" }],
              AND: [
                {
                  OR: [
                    { candidateStudentNumber: { in: allowedSbdsForThisExam } },
                    {
                      AND: [
                        { OR: [{ candidateStudentNumber: null }, { candidateStudentNumber: "" }] },
                        { detectedStudentNumber: { in: allowedSbdsForThisExam } },
                      ],
                    },
                  ],
                },
              ],
            });
          }
        }

        if (submissionConditions.length > 0) {
          whereSubmission.OR = submissionConditions;
        } else {
          whereSubmission.id = "__none__";
        }
      }
    }
  } else if (Object.keys(whereExam).length > 0) {
    whereSubmission.exam = whereExam;
  }
}

  // Student enrollments filter for overview
  if (teacherId && teacherId !== "ALL") {
    whereStudent.enrollments = {
      some: { classId: { in: targetTeacherClassIds.length > 0 ? targetTeacherClassIds : ["__none__"] } },
    };
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
    assignedTeachersRaw,
    totalTeachersCount,
    activeTeachers,
    lockedTeachers,
    totalStudents,
    totalEnrollments,
    totalClasses,
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

    // Teachers (Assigned in scope & Total registered)
    isForbiddenTeacherScope
      ? Promise.resolve([])
      : isTeacher && !isSubjectLeader
      ? Promise.resolve([{ teacherId: teacherProfile?.id || "__none__" }])
      : prisma.teachingAssignment.findMany({
          where: whereAssignment,
          select: { teacherId: true },
          distinct: ["teacherId"],
        }),
    prisma.teacher.count(),
    isForbiddenTeacherScope
      ? 0
      : isTeacher && !isSubjectLeader
      ? (teacherProfile ? 1 : 0)
      : isTeacher && isSubjectLeader
      ? prisma.user.count({
          where: {
            role: "TEACHER",
            status: "ACTIVE",
            teacher: {
              OR: [
                { primarySubjectId: leaderSubjectId },
                { assignments: { some: { subjectId: leaderSubjectId, ...assignmentYearFilter } } },
              ],
            },
          },
        })
      : prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
    isForbiddenTeacherScope
      ? 0
      : isTeacher && !isSubjectLeader
      ? 0
      : isTeacher && isSubjectLeader
      ? prisma.user.count({
          where: {
            role: "TEACHER",
            status: "LOCKED",
            teacher: {
              OR: [
                { primarySubjectId: leaderSubjectId },
                { assignments: { some: { subjectId: leaderSubjectId, ...assignmentYearFilter } } },
              ],
            },
          },
        })
      : prisma.user.count({ where: { role: "TEACHER", status: "LOCKED" } }),

    // Students: Đã được xếp lớp (tuân thủ bộ lọc)
    prisma.student.count({
      where: whereStudent,
    }),
    isForbiddenTeacherScope
      ? 0
      : prisma.studentEnrollment.count({
          where: {
            ...(classId && classId !== "ALL"
              ? { classId }
              : gradeId && gradeId !== "ALL"
              ? { class: { gradeId } }
              : targetTeacherClassIds.length > 0
              ? { classId: { in: targetTeacherClassIds } }
              : isTeacher && !isSubjectLeader
              ? { classId: { in: assignedClassIds.length > 0 ? assignedClassIds : ["__none__"] } }
              : {}),
            ...assignmentYearFilter,
          },
        }),

    // Classes
    isForbiddenTeacherScope ? 0 : prisma.class.count({ where: whereClass }),

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
        examId: true,
        finalScore: true,
        provisionalScore: true,
        status: true,
        identityNeedsReview: true,
        resolvedStudentNumber: true,
        candidateStudentNumber: true,
        detectedStudentNumber: true,
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
    isForbiddenTeacherScope
      ? Promise.resolve([])
      : isTeacher && !isSubjectLeader
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
              { assignments: { some: { subjectId: leaderSubjectId, ...assignmentYearFilter } } },
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

  // Calculate score distribution, average & students with results
  let scoreSum = 0;
  let scoreCount = 0;
  const uniqueStudentsWithResults = new Set();
  const scoreDistribution = {
    excellent: 0, // 8.0 - 10
    good: 0,      // 6.5 - 7.99
    average: 0,   // 5.0 - 6.49
    belowAvg: 0,  // < 5.0
  };

  const examIdsInSubmissions = [...new Set(submissionsScores.map((s) => s.examId))];
  const candidateMappings = examIdsInSubmissions.length > 0
    ? await prisma.examCandidate.findMany({
        where: { examId: { in: examIdsInSubmissions } },
        select: { examId: true, studentNumber: true, studentId: true },
      })
    : [];

  const candidateMap = new Map();
  for (const c of candidateMappings) {
    candidateMap.set(`${c.examId}_${c.studentNumber}`, c.studentId);
  }

  for (const sub of submissionsScores) {
    if (sub.identityNeedsReview) {
      continue;
    }

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

        const sNum =
          (sub.resolvedStudentNumber && sub.resolvedStudentNumber.trim()) ||
          (sub.candidateStudentNumber && sub.candidateStudentNumber.trim()) ||
          (sub.detectedStudentNumber && sub.detectedStudentNumber.trim());
        if (sNum) {
          const resolvedStudentId = candidateMap.get(`${sub.examId}_${sNum}`) || `sbd_${sub.examId}_${sNum}`;
          uniqueStudentsWithResults.add(resolvedStudentId);
        }
      }
    }
  }

  const averageScore =
    scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : null;
  const studentsWithResultsCount = uniqueStudentsWithResults.size;

  const hasFilterApplied = Boolean(
    (gradeId && gradeId !== "ALL") ||
    (classId && classId !== "ALL") ||
    (subjectId && subjectId !== "ALL") ||
    (teacherId && teacherId !== "ALL") ||
    isTeacher
  );

  const assignedTeachersCount = isForbiddenTeacherScope
    ? 0
    : isTeacher && !isSubjectLeader
    ? 1
    : hasFilterApplied
    ? assignedTeachersRaw.length
    : totalTeachersCount;

  // Grade level breakdown (THCS: 6-9, THPT: 10-12)
  const gradeBreakdown = isForbiddenTeacherScope
    ? []
    : allGrades.map((g) => {
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
  const subjectsBreakdown = isForbiddenTeacherScope
    ? []
    : allSubjects.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        examsCount: s._count?.exams || 0,
        examPercentage:
          totalExams > 0
            ? Number((((s._count?.exams || 0) / totalExams) * 100).toFixed(1))
            : 0,
      }));

  // OMR Answer Stats
  const omrAnswers = isForbiddenTeacherScope
    ? { correct: 0, incorrect: 0, blank: 0, unresolved: 0 }
    : {
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
        total: assignedTeachersCount,
        active: isForbiddenTeacherScope ? 0 : activeTeachers,
        locked: isForbiddenTeacherScope ? 0 : lockedTeachers,
        systemTotal: totalTeachersCount,
      },
      students: {
        total: isForbiddenTeacherScope ? 0 : totalStudents,
        enrolled: isForbiddenTeacherScope ? 0 : totalEnrollments,
        withResults: isForbiddenTeacherScope ? 0 : studentsWithResultsCount,
      },
      classes: {
        total: isForbiddenTeacherScope ? 0 : totalClasses,
        thcs: isForbiddenTeacherScope ? 0 : thcsClasses,
        thpt: isForbiddenTeacherScope ? 0 : thptClasses,
      },
      academicYear: currentAcademicYear?.name || "2026-2027",
      exams: {
        total: isForbiddenTeacherScope ? 0 : totalExams,
        draft: isForbiddenTeacherScope ? 0 : examStatusMap.DRAFT,
        published: isForbiddenTeacherScope ? 0 : examStatusMap.PUBLISHED,
        closed: isForbiddenTeacherScope ? 0 : examStatusMap.CLOSED,
        archived: isForbiddenTeacherScope ? 0 : examStatusMap.ARCHIVED,
        resultsPublished: isForbiddenTeacherScope ? 0 : resultsPublishedExamsCount,
      },
      submissions: {
        total: isForbiddenTeacherScope ? 0 : totalSubmissions,
        final: isForbiddenTeacherScope ? 0 : submissionStatusMap.FINAL,
        provisional: isForbiddenTeacherScope ? 0 : submissionStatusMap.PROVISIONAL,
        needsReview: isForbiddenTeacherScope ? 0 : identityNeedsReviewCount,
      },
      scoring: {
        averageScore: isForbiddenTeacherScope ? null : averageScore,
        gradedCount: isForbiddenTeacherScope ? 0 : scoreCount,
        distribution: isForbiddenTeacherScope
          ? { excellent: 0, good: 0, average: 0, belowAvg: 0 }
          : scoreDistribution,
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
    recentExams: isForbiddenTeacherScope
      ? []
      : recentExamsRaw.map((e) => ({
          id: e.id,
          title: e.title,
          subjectName: e.subject?.name || "Chưa xác định",
          className: e.class?.name || "Chưa gán",
          teacherName: e.teacher?.fullName || "Chưa xác định",
          teacherCode: e.teacher?.teacherCode || "",
          status: e.status,
          submissionsCount: e._count?.submissions || 0,
          createdAt: e.createdAt,
        })),
    recentSubmissions: isForbiddenTeacherScope
      ? []
      : recentSubmissionsRaw.map((s) => ({
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
    topTeachers: isForbiddenTeacherScope
      ? []
      : topTeachersRaw.map((t) => ({
          id: t.id,
          fullName: t.fullName,
          teacherCode: t.teacherCode,
          email: t.user?.email,
          status: t.user?.status,
          examsCount: t._count?.exams || 0,
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
      assignedClassCount: isForbiddenTeacherScope ? 0 : assignedClassIds.length,
      teacherFullName: teacherProfile?.fullName || user?.fullName || null,
    },
  };
}
