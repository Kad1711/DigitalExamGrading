import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

// Re-export utility functions for full backwards compatibility
export { compareVietnameseNames } from "../utils/vietnamese-sort.js";
export { makeStudentEmail, generateSmartSbd } from "../utils/sbd-generator.js";

// Re-export student enrollment & Excel import functions for backwards compatibility
export {
  listClassStudents,
  addStudentToClass,
  removeStudentFromClass,
  updateStudent,
  clearClassStudents,
  bulkRemoveStudentsFromClass,
  standardizeClassSbd,
} from "./student-enrollment.service.js";

export {
  parseExcelPreview,
  importStudentsFromExcel,
} from "./student-excel-import.service.js";

/**
 * List all available grades
 */
export async function listGrades() {
  return prisma.grade.findMany({
    where: { level: { in: [6, 7, 8, 9] } },
    orderBy: { level: "asc" },
  });
}

/**
 * List all classes with student count
 */
export async function listClasses() {
  const classes = await prisma.class.findMany({
    select: {
      id: true,
      name: true,
      gradeId: true,
      academicYearId: true,
      grade: {
        select: {
          id: true,
          level: true,
          name: true,
        },
      },
      academicYear: {
        select: {
          id: true,
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
        select: {
          teacherId: true,
          subjectId: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              teacherCode: true,
            },
          },
        },
      },
      createdAt: true,
    },
    orderBy: [{ grade: { level: "asc" } }, { name: "asc" }],
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    gradeId: c.gradeId,
    gradeName: c.grade.name,
    gradeLevel: c.grade.level,
    academicYearId: c.academicYearId,
    academicYearName: c.academicYear.name,
    studentCount: c._count.enrollments,
    examCount: c._count.exams,
    assignedTeacherIds: (c.assignments || []).map((a) => a.teacherId),
    assignedTeachers: (c.assignments || []).map((a) => a.teacher?.fullName).filter(Boolean),
    createdAt: c.createdAt,
  }));
}

/**
 * Create a new class
 */
export async function createClass({ name, gradeId, teacherUserId }) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
  });
  if (!grade) {
    throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
  }
  if (![6, 7, 8, 9].includes(grade.level)) {
    throw new AppError("Hệ thống chỉ hỗ trợ các khối lớp THCS (Khối 6, 7, 8, 9).", 400, "INVALID_GRADE_LEVEL");
  }

  let academicYear = await prisma.academicYear.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { name: "2026-2027" },
    });
  }

  const existingClass = await prisma.class.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      academicYearId: academicYear.id,
    },
  });

  if (existingClass) {
    throw new AppError(
      `Lớp "${name.trim()}" đã tồn tại trong năm học ${academicYear.name}.`,
      409,
      "CLASS_ALREADY_EXISTS"
    );
  }

  const newClass = await prisma.class.create({
    data: {
      name: name.trim(),
      gradeId: grade.id,
      academicYearId: academicYear.id,
    },
    include: {
      grade: true,
      academicYear: true,
    },
  });

  if (teacherUserId) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherUserId },
    });

    if (teacher) {
      const subject = await prisma.subject.findFirst();
      if (subject) {
        await prisma.teachingAssignment.create({
          data: {
            teacherId: teacher.id,
            subjectId: subject.id,
            classId: newClass.id,
            academicYearId: academicYear.id,
          },
        }).catch(() => {});
      }
    }
  }

  return {
    id: newClass.id,
    name: newClass.name,
    gradeId: newClass.gradeId,
    gradeName: newClass.grade.name,
    gradeLevel: newClass.grade.level,
    academicYearId: newClass.academicYearId,
    academicYearName: newClass.academicYear.name,
    studentCount: 0,
    examCount: 0,
    createdAt: newClass.createdAt,
  };
}

/**
 * Create multiple classes in batch
 */
export async function createBatchClasses({ names, gradeId, teacherUserId }) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
  });
  if (!grade) {
    throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
  }
  if (![6, 7, 8, 9].includes(grade.level)) {
    throw new AppError("Hệ thống chỉ hỗ trợ các khối lớp THCS (Khối 6, 7, 8, 9).", 400, "INVALID_GRADE_LEVEL");
  }

  let academicYear = await prisma.academicYear.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { name: "2026-2027" },
    });
  }

  const createdClasses = [];
  const skippedNames = [];

  let teacher = null;
  let subject = null;
  if (teacherUserId) {
    teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
    if (teacher) {
      subject = await prisma.subject.findFirst();
    }
  }

  for (const rawName of names) {
    const trimmed = rawName.trim();
    if (!trimmed) continue;

    const existing = await prisma.class.findFirst({
      where: {
        name: { equals: trimmed, mode: "insensitive" },
        academicYearId: academicYear.id,
      },
    });

    if (existing) {
      skippedNames.push(trimmed);
      continue;
    }

    const newClass = await prisma.class.create({
      data: {
        name: trimmed,
        gradeId: grade.id,
        academicYearId: academicYear.id,
      },
      include: {
        grade: true,
        academicYear: true,
      },
    });

    if (teacher && subject) {
      await prisma.teachingAssignment.create({
        data: {
          teacherId: teacher.id,
          subjectId: subject.id,
          classId: newClass.id,
          academicYearId: academicYear.id,
        },
      }).catch(() => {});
    }

    createdClasses.push({
      id: newClass.id,
      name: newClass.name,
      gradeId: newClass.gradeId,
      gradeName: newClass.grade.name,
      gradeLevel: newClass.grade.level,
      academicYearId: newClass.academicYearId,
      academicYearName: newClass.academicYear.name,
      studentCount: 0,
      examCount: 0,
      createdAt: newClass.createdAt,
    });
  }

  if (createdClasses.length === 0 && skippedNames.length > 0) {
    throw new AppError(
      "Tất cả các lớp trong danh sách đều đã tồn tại.",
      409,
      "ALL_CLASSES_ALREADY_EXIST"
    );
  }

  return {
    created: createdClasses,
    skipped: skippedNames,
    totalCreated: createdClasses.length,
    totalSkipped: skippedNames.length,
  };
}

/**
 * Delete class safely with cascade cleanup
 */
export async function deleteClass(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      _count: {
        select: {
          enrollments: true,
          exams: true,
        },
      },
    },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.studentEnrollment.deleteMany({ where: { classId } });
    await tx.teachingAssignment.deleteMany({ where: { classId } });

    const exams = await tx.exam.findMany({ where: { classId } });
    for (const exam of exams) {
      const subIds = (await tx.examSubmission.findMany({ where: { examId: exam.id }, select: { id: true } })).map(s => s.id);
      if (subIds.length > 0) {
        await tx.submissionAnswer.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmissionAuditLog.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmission.deleteMany({ where: { id: { in: subIds } } });
      }
      await tx.examResultPublicationLog.deleteMany({ where: { examId: exam.id } });
      await tx.examCandidate.deleteMany({ where: { examId: exam.id } });
      const examCodes = await tx.examCode.findMany({ where: { examId: exam.id }, select: { id: true } });
      await tx.answerKey.deleteMany({ where: { examCodeId: { in: examCodes.map(c => c.id) } } });
      await tx.examCode.deleteMany({ where: { examId: exam.id } });
      await tx.answerSheetTemplate.deleteMany({ where: { examId: exam.id } });
      await tx.exam.delete({ where: { id: exam.id } });
    }

    await tx.class.delete({ where: { id: classId } });
  });

  return {
    id: cls.id,
    name: cls.name,
    message: `Đã xóa lớp học "${cls.name}" thành công.`,
  };
}

/**
 * Update class details (name and/or grade)
 */
export async function updateClass(classId, { name, gradeId }) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      grade: true,
      academicYear: true,
      _count: { select: { enrollments: true, exams: true } },
    },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const updateData = {};

  if (name && name.trim() !== cls.name) {
    const trimmedName = name.trim();
    const duplicate = await prisma.class.findFirst({
      where: {
        academicYearId: cls.academicYearId,
        name: { equals: trimmedName, mode: "insensitive" },
        id: { not: classId },
      },
    });

    if (duplicate) {
      throw new AppError(
        `Lớp "${trimmedName}" đã tồn tại trong năm học ${cls.academicYear.name}.`,
        409,
        "CLASS_ALREADY_EXISTS"
      );
    }
    updateData.name = trimmedName;
  }

  if (gradeId && gradeId !== cls.gradeId) {
    const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
    if (!grade) {
      throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
    }
    if (![6, 7, 8, 9].includes(grade.level)) {
      throw new AppError("Hệ thống chỉ hỗ trợ các khối lớp THCS (Khối 6, 7, 8, 9).", 400, "INVALID_GRADE_LEVEL");
    }
    updateData.gradeId = grade.id;
  }

  const updated = await prisma.class.update({
    where: { id: classId },
    data: updateData,
    include: {
      grade: true,
      academicYear: true,
      _count: { select: { enrollments: true, exams: true } },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    gradeId: updated.gradeId,
    gradeName: updated.grade.name,
    gradeLevel: updated.grade.level,
    academicYearId: updated.academicYearId,
    academicYearName: updated.academicYear.name,
    studentCount: updated._count.enrollments,
    examCount: updated._count.exams,
    createdAt: updated.createdAt,
  };
}

/**
 * Xóa nhiều lớp học được chọn
 */
export async function bulkDeleteClasses(classIds = []) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    throw new AppError("Danh sách lớp cần xóa không hợp lệ.", 400, "INVALID_CLASS_IDS");
  }

  let deletedCount = 0;
  for (const cid of classIds) {
    try {
      await deleteClass(cid);
      deletedCount++;
    } catch {
      // Continue deleting remaining classes
    }
  }

  return {
    deletedCount,
    message: `Đã xóa thành công ${deletedCount} lớp học.`,
  };
}
