import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

export async function verifyExamOwnership(examId, teacherUserId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { teacher: true, class: true },
  });

  if (!exam) {
    throw new AppError("Kỳ thi không tồn tại hoặc đã bị xóa.", 404, "EXAM_NOT_FOUND");
  }

  if (exam.teacher?.userId !== teacherUserId) {
    throw new AppError("Bạn không có quyền truy cập kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
  }

  return exam;
}

export async function listExamCandidates(teacherUserId, examId) {
  await verifyExamOwnership(examId, teacherUserId);

  const candidates = await prisma.examCandidate.findMany({
    where: { examId },
    include: {
      student: {
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      studentNumber: "asc",
    },
  });

  return candidates.map((c) => ({
    id: c.id,
    examId: c.examId,
    studentId: c.studentId,
    studentNumber: c.studentNumber,
    studentCode: c.student.studentCode,
    studentName: c.student.fullName,
    studentEmail: c.student.user?.email || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function getEligibleStudents(teacherUserId, examId) {
  const exam = await verifyExamOwnership(examId, teacherUserId);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { classId: exam.classId },
    include: {
      student: {
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      student: {
        studentCode: "asc",
      },
    },
  });

  const assignedCandidates = await prisma.examCandidate.findMany({
    where: { examId },
    select: { studentId: true, studentNumber: true },
  });

  const assignedMap = new Map(assignedCandidates.map((c) => [c.studentId, c.studentNumber]));

  return enrollments.map((en) => ({
    studentId: en.student.id,
    studentCode: en.student.studentCode,
    studentName: en.student.fullName,
    studentEmail: en.student.user?.email || null,
    isAssigned: assignedMap.has(en.student.id),
    assignedStudentNumber: assignedMap.get(en.student.id) || null,
  }));
}

export async function assignCandidate(teacherUserId, examId, { studentId, studentNumber }) {
  const exam = await verifyExamOwnership(examId, teacherUserId);

  if (exam.status === "ARCHIVED") {
    throw new AppError(
      "Kỳ thi đã được lưu trữ (ARCHIVED), không thể thay đổi danh sách thí sinh.",
      400,
      "EXAM_ARCHIVED"
    );
  }

  if (exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi đã được công bố. Không thể thay đổi danh sách thí sinh.",
      409,
      "RESULTS_PUBLISHED_LOCKED"
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { enrollments: true },
  });

  if (!student) {
    throw new AppError("Không tìm thấy thông tin học sinh.", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  if (student.enrollments.length > 0) {
    const isEnrolledInExamClass = student.enrollments.some((en) => en.classId === exam.classId);
    if (!isEnrolledInExamClass) {
      throw new AppError(
        "Học sinh không thuộc lớp của kỳ thi này.",
        422,
        "STUDENT_NOT_IN_EXAM_CLASS"
      );
    }
  }

  const existingByStudent = await prisma.examCandidate.findUnique({
    where: {
      examId_studentId: {
        examId,
        studentId,
      },
    },
  });

  if (existingByStudent) {
    if (existingByStudent.studentNumber === studentNumber) {
      return existingByStudent;
    }
    const existingByNumber = await prisma.examCandidate.findUnique({
      where: {
        examId_studentNumber: {
          examId,
          studentNumber,
        },
      },
    });
    if (existingByNumber && existingByNumber.id !== existingByStudent.id) {
      throw new AppError(
        "Số báo danh này đã được gán cho một học sinh khác trong kỳ thi.",
        409,
        "EXAM_CANDIDATE_DUPLICATE_NUMBER"
      );
    }
    return await prisma.examCandidate.update({
      where: { id: existingByStudent.id },
      data: { studentNumber },
      include: { student: true },
    });
  }

  const existingByNumber = await prisma.examCandidate.findUnique({
    where: {
      examId_studentNumber: {
        examId,
        studentNumber,
      },
    },
  });

  if (existingByNumber) {
    throw new AppError(
      "Số báo danh này đã được gán cho một học sinh khác trong kỳ thi.",
      409,
      "EXAM_CANDIDATE_DUPLICATE_NUMBER"
    );
  }

  try {
    return await prisma.examCandidate.create({
      data: {
        examId,
        studentId,
        studentNumber,
      },
      include: {
        student: true,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw new AppError(
        "Học sinh hoặc số báo danh đã tồn tại trong kỳ thi này.",
        409,
        "EXAM_CANDIDATE_DUPLICATE"
      );
    }
    throw err;
  }
}

export async function removeCandidate(teacherUserId, examId, candidateId) {
  const exam = await verifyExamOwnership(examId, teacherUserId);

  if (exam.status === "ARCHIVED") {
    throw new AppError(
      "Kỳ thi đã được lưu trữ (ARCHIVED), không thể thay đổi danh sách thí sinh.",
      400,
      "EXAM_ARCHIVED"
    );
  }

  if (exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi đã được công bố. Không thể thay đổi danh sách thí sinh.",
      409,
      "RESULTS_PUBLISHED_LOCKED"
    );
  }

  const candidate = await prisma.examCandidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate || candidate.examId !== examId) {
    throw new AppError("Không tìm thấy thông tin thí sinh.", 404, "EXAM_CANDIDATE_NOT_FOUND");
  }

  await prisma.examCandidate.delete({
    where: { id: candidateId },
  });

  return { success: true, message: "Đã xóa liên kết thí sinh." };
}
