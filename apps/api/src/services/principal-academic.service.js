import prisma from "../config/prisma.js";

/**
 * Get comprehensive Academic Structure for Principal / Leadership oversight.
 * Returns grades 6-9, classes, subjects, teachers, subject leaders, and teaching assignments.
 */
export async function getAcademicStructure() {
  const [grades, subjects, teachers] = await Promise.all([
    prisma.grade.findMany({
      orderBy: { level: "asc" },
      include: {
        classes: {
          select: {
            id: true,
            name: true,
            gradeId: true,
            _count: {
              select: {
                enrollments: true,
                assignments: true,
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    }),

    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),

    prisma.teacher.findMany({
      where: {
        user: { status: "ACTIVE" },
      },
      select: {
        id: true,
        teacherCode: true,
        fullName: true,
        phone: true,
        title: true,
        isSubjectLeader: true,
        primarySubjectId: true,
        primarySubject: {
          select: { id: true, name: true, code: true },
        },
        assignments: {
          select: {
            id: true,
            classId: true,
            subjectId: true,
            class: { select: { id: true, name: true, gradeId: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        user: {
          select: { id: true, email: true, status: true },
        },
      },
      orderBy: [
        { isSubjectLeader: "desc" },
        { fullName: "asc" },
      ],
    }),
  ]);

  // Aggregate breakdown per Subject (Tổ bộ môn)
  const subjectsBreakdown = subjects.map((subj) => {
    // Teachers whose primarySubject is this subject OR who teach this subject
    const subjectTeachers = teachers.filter(
      (t) =>
        t.primarySubjectId === subj.id ||
        t.assignments.some((a) => a.subjectId === subj.id)
    );

    // Identify Subject Leader (Tổ trưởng) for this subject
    const leader = teachers.find(
      (t) => t.isSubjectLeader === true && t.primarySubjectId === subj.id
    );

    // Set of distinct classes assigned to this subject
    const assignedClassIds = new Set();
    subjectTeachers.forEach((t) => {
      t.assignments
        .filter((a) => a.subjectId === subj.id)
        .forEach((a) => assignedClassIds.add(a.classId));
    });

    return {
      id: subj.id,
      code: subj.code,
      name: subj.name,
      leader: leader
        ? {
            id: leader.id,
            teacherCode: leader.teacherCode,
            fullName: leader.fullName,
            email: leader.user?.email,
            phone: leader.phone,
          }
        : null,
      teacherCount: subjectTeachers.length,
      assignedClassCount: assignedClassIds.size,
      teachers: subjectTeachers.map((t) => ({
        id: t.id,
        teacherCode: t.teacherCode,
        fullName: t.fullName,
        email: t.user?.email,
        phone: t.phone,
        isSubjectLeader: t.isSubjectLeader,
        isLeaderOfThisSubject: t.isSubjectLeader && t.primarySubjectId === subj.id,
        title: t.isSubjectLeader ? "Tổ trưởng chuyên môn" : (t.title || "Giáo viên"),
        assignedClasses: t.assignments
          .filter((a) => a.subjectId === subj.id)
          .map((a) => ({
            id: a.class?.id,
            name: a.class?.name,
            gradeId: a.class?.gradeId,
          })),
      })),
    };
  });

  const totalClasses = grades.reduce((acc, g) => acc + g.classes.length, 0);
  const totalSubjectLeaders = teachers.filter((t) => t.isSubjectLeader === true).length;

  const formattedGrades = grades.map((g) => ({
    ...g,
    classes: g.classes.map((c) => ({
      ...c,
      _count: {
        students: c._count?.enrollments ?? 0,
        enrollments: c._count?.enrollments ?? 0,
        teachingAssignments: c._count?.assignments ?? 0,
        assignments: c._count?.assignments ?? 0,
      },
    })),
  }));

  return {
    summary: {
      totalTeachers: teachers.length,
      totalSubjects: subjects.length,
      totalClasses,
      totalSubjectLeaders,
    },
    subjectsBreakdown,
    grades: formattedGrades,
  };
}
