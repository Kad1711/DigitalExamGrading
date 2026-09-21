import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

// =====================================================
// OWNERSHIP HELPERS
// =====================================================

export async function getTeacherProfile(userId) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    throw new AppError(
      "Ban chua co ho so giao vien. Vui long lien he Admin.",
      403,
      "TEACHER_PROFILE_NOT_FOUND"
    );
  }
  return teacher;
}

export async function assertExamAccess(examId, reqUser) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true, level: true } },
      examClasses: { include: { class: { select: { id: true, name: true } } } },
      teacher: { select: { id: true, fullName: true, teacherCode: true } },
      examCodes: { select: { id: true, code: true } },
    },
  });

  if (!exam) {
    throw new AppError("Ky thi khong ton tai.", 404, "EXAM_NOT_FOUND");
  }

  if (reqUser.role === "ADMIN") {
    return exam;
  }

  const teacher = await getTeacherProfile(reqUser.id);
  // 1. Direct owner
  if (exam.teacherId && exam.teacherId === teacher.id) {
    return exam;
  }

  // 2. Or teacher teaches this exam's subject in the primary class or any assigned examClasses
  const examClassIds = [
    ...(exam.classId ? [exam.classId] : []),
    ...(exam.examClasses ? exam.examClasses.map((ec) => ec.classId) : []),
  ];

  if (examClassIds.length > 0) {
    const assignment = await prisma.teachingAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        subjectId: exam.subjectId,
        classId: { in: examClassIds },
      },
    });
    if (assignment) {
      return exam;
    }
  }

  throw new AppError(
    "Ban khong co quyen truy cap ky thi nay.",
    403,
    "EXAM_ACCESS_DENIED"
  );
}

export function assertExamDraft(exam) {
  if (exam.status !== "DRAFT") {
    throw new AppError(
      "Hanh dong nay chi duoc phep khi ky thi o trang thai DRAFT.",
      409,
      "EXAM_NOT_DRAFT"
    );
  }
}

// =====================================================
// EXAM CRUD
// =====================================================

export async function createExam(data, reqUser) {
  if (reqUser.role !== "ADMIN") {
    throw new AppError(
      "Chỉ Ban Giám Hiệu (Quản trị viên) mới có quyền khởi tạo đề thi.",
      403,
      "FORBIDDEN"
    );
  }

  let teacherId = null;
  if (data.teacherId) {
    teacherId = data.teacherId;
  } else {
    const adminTeacher = await prisma.teacher.findUnique({
      where: { userId: reqUser.id },
    });
    teacherId = adminTeacher ? adminTeacher.id : null;
  }

  const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
  if (!subject) {
    throw new AppError("Mon hoc khong ton tai.", 404, "SUBJECT_NOT_FOUND");
  }

  const classIds = Array.isArray(data.classIds) && data.classIds.length > 0
    ? data.classIds
    : (data.classId ? [data.classId] : []);

  const primaryClassId = classIds.length > 0 ? classIds[0] : (data.classId || null);

  return prisma.exam.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      teacherId,
      subjectId: data.subjectId,
      classId: primaryClassId,
      gradeId: data.gradeId ?? null,
      durationMinutes: data.durationMinutes ?? 45,
      sheetPreset: data.sheetPreset ?? "PRESET_TERM_50Q",
      questionCount: data.questionCount,
      maxScore: data.maxScore,
      scoringType: data.scoringType,
      allowStudentViewAnswers: data.allowStudentViewAnswers ?? false,
      allowStudentViewImage: data.allowStudentViewImage ?? false,
      status: "DRAFT",
      examClasses: classIds.length > 0
        ? {
            create: classIds.map((cId) => ({ classId: cId })),
          }
        : undefined,
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true, level: true } },
      examClasses: { include: { class: { select: { id: true, name: true } } } },
      teacher: { select: { id: true, fullName: true, teacherCode: true } },
    },
  });
}

export async function listExams(query, reqUser) {
  const { status, subjectId, classId, gradeId, search, page = 1, limit = 20 } = query;
  const where = {};

  if (reqUser.role === "TEACHER") {
    const teacher = await getTeacherProfile(reqUser.id);
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true, subjectId: true },
    });
    const assignedClassIds = assignments.map((a) => a.classId);
    const assignedSubjectIds = [...new Set(assignments.map((a) => a.subjectId))];

    where.OR = [
      { teacherId: teacher.id },
      {
        subjectId: { in: assignedSubjectIds },
        OR: [
          { classId: { in: assignedClassIds } },
          { examClasses: { some: { classId: { in: assignedClassIds } } } },
        ],
      },
    ];
  }

  if (status) where.status = status;
  if (subjectId) where.subjectId = subjectId;
  if (gradeId) where.gradeId = gradeId;
  if (classId) {
    where.OR = [
      { classId },
      { examClasses: { some: { classId } } },
    ];
  }
  if (search) where.title = { contains: search, mode: "insensitive" };

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, level: true } },
        examClasses: { include: { class: { select: { id: true, name: true } } } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { examCodes: true, submissions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
  ]);

  return {
    data: exams,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
}

export async function getExamById(examId, reqUser) {
  return assertExamAccess(examId, reqUser);
}

export async function updateExam(examId, data, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);

  if (exam.status === "CLOSED") {
    throw new AppError(
      "Không thể chỉnh sửa kỳ thi đã đóng.",
      409,
      "EXAM_FIELD_LOCKED"
    );
  }

  if (exam.status === "ARCHIVED") {
    throw new AppError(
      "Không thể chỉnh sửa kỳ thi đã lưu trữ.",
      409,
      "EXAM_FIELD_LOCKED"
    );
  }

  if (exam.status === "PUBLISHED") {
    const lockedFields = [
      "subjectId",
      "classId",
      "questionCount",
      "maxScore",
      "scoringType",
    ];
    for (const field of lockedFields) {
      if (data[field] !== undefined) {
        throw new AppError(
          `Trường '${field}' đã bị khóa sau khi kỳ thi được phát hành.`,
          409,
          "EXAM_FIELD_LOCKED"
        );
      }
    }
  }

  const updateData = {
    title: data.title,
    description: data.description,
    subjectId: data.subjectId,
    classId: data.classId !== undefined ? data.classId : undefined,
    gradeId: data.gradeId !== undefined ? data.gradeId : undefined,
    durationMinutes: data.durationMinutes !== undefined ? data.durationMinutes : undefined,
    sheetPreset: data.sheetPreset !== undefined ? data.sheetPreset : undefined,
    questionCount: data.questionCount,
    maxScore: data.maxScore,
    scoringType: data.scoringType,
    allowStudentViewAnswers: data.allowStudentViewAnswers,
    allowStudentViewImage: data.allowStudentViewImage,
  };

  if (data.classIds && Array.isArray(data.classIds)) {
    await prisma.examClass.deleteMany({ where: { examId } });
    if (data.classIds.length > 0) {
      await prisma.examClass.createMany({
        data: data.classIds.map((cId) => ({ examId, classId: cId })),
      });
      if (!data.classId) {
        updateData.classId = data.classIds[0];
      }
    }
  }

  return prisma.exam.update({
    where: { id: examId },
    data: updateData,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true, level: true } },
      examClasses: { include: { class: { select: { id: true, name: true } } } },
      teacher: { select: { id: true, fullName: true } },
    },
  });
}

export async function deleteExam(examId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  if (exam.status !== "DRAFT") {
    throw new AppError(
      "Chỉ có thể xóa vĩnh viễn kỳ thi ở trạng thái Nháp.",
      409,
      "EXAM_DELETE_NOT_ALLOWED"
    );
  }

  await prisma.$transaction(async (tx) => {
    const subIds = (await tx.examSubmission.findMany({ where: { examId }, select: { id: true } })).map(s => s.id);
    if (subIds.length > 0) {
      await tx.submissionAnswer.deleteMany({ where: { submissionId: { in: subIds } } });
      await tx.examSubmissionAuditLog.deleteMany({ where: { submissionId: { in: subIds } } });
      await tx.examSubmission.deleteMany({ where: { id: { in: subIds } } });
    }
    await tx.examResultPublicationLog.deleteMany({ where: { examId } });
    await tx.examCandidate.deleteMany({ where: { examId } });
    const examCodes = await tx.examCode.findMany({ where: { examId }, select: { id: true } });
    await tx.answerKey.deleteMany({ where: { examCodeId: { in: examCodes.map(c => c.id) } } });
    await tx.examCode.deleteMany({ where: { examId } });
    await tx.answerSheetTemplate.deleteMany({ where: { examId } });
    await tx.exam.delete({ where: { id: examId } });
  });

  return { id: examId, title: exam.title, message: `Đã xóa kỳ thi "${exam.title}" thành công.` };
}

export async function bulkDeleteExams(examIds = [], reqUser) {
  if (!Array.isArray(examIds) || examIds.length === 0) {
    throw new AppError("Danh sách kỳ thi cần xóa không hợp lệ.", 400, "INVALID_EXAM_IDS");
  }

  let deletedCount = 0;
  for (const id of examIds) {
    try {
      await deleteExam(id, reqUser);
      deletedCount++;
    } catch (err) {
      console.warn(`Could not delete exam ${id}:`, err.message);
    }
  }

  return {
    deletedCount,
    message: `Đã xóa thành công ${deletedCount} kỳ thi.`,
  };
}

export async function cloneExam(examId, reqUser) {
  const sourceExam = await assertExamAccess(examId, reqUser);

  // Fetch all ExamCodes of source exam with their AnswerKeys
  const sourceCodes = await prisma.examCode.findMany({
    where: { examId },
    include: {
      answerKeys: {
        orderBy: { questionNumber: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  // Default title: "<old title> - Bản sao" (clamped to 255 chars)
  let clonedTitle = `${sourceExam.title} - Bản sao`;
  if (clonedTitle.length > 255) {
    clonedTitle = clonedTitle.slice(0, 255);
  }

  // Atomic transaction
  const clonedExam = await prisma.$transaction(async (tx) => {
    // 1. Create new exam in DRAFT state
    const newExam = await tx.exam.create({
      data: {
        title: clonedTitle,
        description: sourceExam.description,
        teacherId: sourceExam.teacherId,
        subjectId: sourceExam.subjectId,
        classId: sourceExam.classId,
        questionCount: sourceExam.questionCount,
        maxScore: sourceExam.maxScore,
        scoringType: sourceExam.scoringType,
        allowStudentViewAnswers: sourceExam.allowStudentViewAnswers,
        allowStudentViewImage: sourceExam.allowStudentViewImage,
        status: "DRAFT",
        publishedAt: null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true, teacherCode: true } },
      },
    });

    // 2. Clone ExamCodes and their AnswerKeys
    for (const sc of sourceCodes) {
      const newCode = await tx.examCode.create({
        data: {
          examId: newExam.id,
          code: sc.code,
        },
      });

      if (sc.answerKeys.length > 0) {
        await tx.answerKey.createMany({
          data: sc.answerKeys.map((ak) => ({
            examCodeId: newCode.id,
            questionNumber: ak.questionNumber,
            correctAnswer: ak.correctAnswer,
            score: ak.score,
          })),
        });
      }
    }

    // NOTE: AnswerSheetTemplate is INTENTIONALLY NOT CLONED!
    // The clone intentionally has no template. Teacher must generate a new OMR template
    // to bind with the new examId, new templateId, and new QR metadata.

    return newExam;
  });

  return clonedExam;
}

// =====================================================
// PUBLISH / CLOSE / ARCHIVE
// =====================================================

export async function publishExam(examId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);

  if (exam.status !== "DRAFT") {
    throw new AppError(
      "Chi co the publish Exam o trang thai DRAFT.",
      409,
      "EXAM_ALREADY_PUBLISHED"
    );
  }

  const examCodes = await prisma.examCode.findMany({
    where: { examId },
    include: {
      answerKeys: {
        select: { questionNumber: true, score: true },
        orderBy: { questionNumber: "asc" },
      },
    },
  });

  if (examCodes.length === 0) {
    throw new AppError(
      "Ky thi phai co it nhat 1 ma de truoc khi publish.",
      400,
      "EXAM_CODE_REQUIRED"
    );
  }

  const maxScore = Number(exam.maxScore);
  const errors = [];

  for (const ec of examCodes) {
    const count = ec.answerKeys.length;
    if (count !== exam.questionCount) {
      errors.push(
        `Ma de '${ec.code}': can ${exam.questionCount} dap an, hien co ${count}.`
      );
      continue;
    }
    // Luu y: Voi EQUAL, chi can du so luong dap an (count === exam.questionCount).
    // Khong kiem tra tong diem per-question vi EQUAL tinh diem theo ti le (correctCount / questionCount) * maxScore.
    // Voi CUSTOM, bat buoc tong diem tung cau phai chinh xac bang maxScore.
    if (exam.scoringType === "CUSTOM") {
      const total = ec.answerKeys.reduce((sum, ak) => sum + Number(ak.score), 0);
      const rounded = Math.round(total * 10000) / 10000;
      if (Math.abs(rounded - maxScore) > 0.0001) {
        errors.push(
          `Ma de '${ec.code}': tong diem ${rounded} khong bang maxScore ${maxScore}.`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new AppError(
      "Ky thi chua san sang de publish: " + errors.join(" | "),
      400,
      "ANSWER_KEY_INCOMPLETE"
    );
  }

  return prisma.exam.update({
    where: { id: examId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: {
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  });
}

export async function closeExam(examId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  if (exam.status !== "PUBLISHED") {
    throw new AppError(
      "Chi co the close Exam o trang thai PUBLISHED.",
      409,
      "EXAM_INVALID_STATUS"
    );
  }
  return prisma.exam.update({ where: { id: examId }, data: { status: "CLOSED" } });
}

export async function archiveExam(examId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  if (exam.status !== "CLOSED") {
    throw new AppError(
      "Chi co the archive Exam o trang thai CLOSED.",
      409,
      "EXAM_INVALID_STATUS"
    );
  }
  return prisma.exam.update({ where: { id: examId }, data: { status: "ARCHIVED" } });
}