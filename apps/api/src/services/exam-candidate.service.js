import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess } from "./exam.service.js";

function getExamClassIds(exam) {
  return [
    ...(exam.classId ? [exam.classId] : []),
    ...(exam.examClasses ? exam.examClasses.map((ec) => ec.classId) : []),
  ];
}

export async function verifyExamOwnership(examId, teacherUserId, userRole = "TEACHER") {
  return assertExamAccess(examId, { id: teacherUserId, role: userRole });
}

export async function listExamCandidates(teacherUserId, examId, userRole = "TEACHER") {
  await verifyExamOwnership(examId, teacherUserId, userRole);

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

export async function getEligibleStudents(teacherUserId, examId, userRole = "TEACHER") {
  const exam = await verifyExamOwnership(examId, teacherUserId, userRole);
  const classIds = getExamClassIds(exam);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: classIds.length > 0 ? { classId: { in: classIds } } : { classId: "none" },
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

export async function assignCandidate(teacherUserId, examId, { studentId, studentNumber }, userRole = "TEACHER") {
  const exam = await verifyExamOwnership(examId, teacherUserId, userRole);

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

  const classIds = getExamClassIds(exam);
  if (student.enrollments.length > 0 && classIds.length > 0) {
    const isEnrolledInExamClass = student.enrollments.some((en) => classIds.includes(en.classId));
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

export async function removeCandidate(teacherUserId, examId, candidateId, userRole = "TEACHER") {
  const exam = await verifyExamOwnership(examId, teacherUserId, userRole);

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

/**
 * Tự động gán toàn bộ học sinh trong lớp của kỳ thi vào số báo danh (SBD).
 * Khớp theo: mã học sinh, số báo danh trong bài nộp, hoặc chữ số trong email.
 */
export async function autoAssignCandidates(teacherUserId, examId, userRole = "TEACHER") {
  const exam = await verifyExamOwnership(examId, teacherUserId, userRole);

  if (exam.status === "ARCHIVED") {
    throw new AppError(
      "Kỳ thi đã được lưu trữ (ARCHIVED), không thể thay đổi danh sách thí sinh.",
      400,
      "EXAM_ARCHIVED"
    );
  }

  // Lưu ý: Cho phép tự động gán cả khi đã công bố kết quả để học sinh có thể lập tức tra cứu điểm
  const classIds = getExamClassIds(exam);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: classIds.length > 0 ? { classId: { in: classIds } } : { classId: "none" },
    include: {
      student: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
  });

  const existingCandidates = await prisma.examCandidate.findMany({
    where: { examId },
  });
  const assignedStudentIds = new Set(existingCandidates.map((c) => c.studentId));
  const assignedNumbers = new Set(existingCandidates.map((c) => c.studentNumber));

  const submissions = await prisma.examSubmission.findMany({
    where: {
      examId,
      resolvedStudentNumber: { not: null },
    },
    select: { resolvedStudentNumber: true },
  });
  const submissionSbds = submissions.map((s) => s.resolvedStudentNumber.trim());

  let assignedCount = 0;
  const newlyAssigned = [];

  for (const en of enrollments) {
    const student = en.student;
    if (assignedStudentIds.has(student.id)) continue;

    const cleanCode = (student.studentCode || "").trim();
    const emailPrefix = (student.user?.email || "").split("@")[0];

    let candidateSbd = null;

    const matchedSbd = submissionSbds.find((sbd) => {
      if (assignedNumbers.has(sbd)) return false;
      return (
        sbd === cleanCode ||
        cleanCode.endsWith(sbd) ||
        emailPrefix.includes(sbd) ||
        (sbd.length >= 4 && cleanCode.includes(sbd))
      );
    });

    if (matchedSbd) {
      candidateSbd = matchedSbd;
    } else if (cleanCode && /^\d{4,10}$/.test(cleanCode) && !assignedNumbers.has(cleanCode)) {
      candidateSbd = cleanCode;
    } else {
      const digitsMatch = emailPrefix.match(/\d{6}/);
      if (digitsMatch && !assignedNumbers.has(digitsMatch[0])) {
        candidateSbd = digitsMatch[0];
      }
    }

    if (candidateSbd && !assignedNumbers.has(candidateSbd)) {
      try {
        const created = await prisma.examCandidate.create({
          data: {
            examId,
            studentId: student.id,
            studentNumber: candidateSbd,
          },
          include: { student: true },
        });
        assignedStudentIds.add(student.id);
        assignedNumbers.add(candidateSbd);
        assignedCount++;
        newlyAssigned.push(created);
      } catch (err) {
        // Skip on duplicate
      }
    }
  }

  return {
    success: true,
    assignedCount,
    totalAssigned: existingCandidates.length + assignedCount,
    candidates: newlyAssigned,
  };
}
