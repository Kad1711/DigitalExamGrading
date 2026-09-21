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
      createdByUser: { select: { id: true, fullName: true, role: true } },
      examCodes: { select: { id: true, code: true } },
    },
  });

  if (!exam) {
    throw new AppError("Ky thi khong ton tai.", 404, "EXAM_NOT_FOUND");
  }

  // School oversight and Academic board can view all exams
  if (["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACADEMIC_BOARD"].includes(reqUser.role)) {
    return exam;
  }

  // Exam Board can view all official exams or exams created by them
  if (reqUser.role === "EXAM_BOARD") {
    if (
      exam.createdByUserId === reqUser.id ||
      ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType)
    ) {
      return exam;
    }
  }

  // Direct creator check
  if (exam.createdByUserId && exam.createdByUserId === reqUser.id) {
    return exam;
  }

  // Teacher check
  if (reqUser.role === "TEACHER") {
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

export async function assertExamManageAccess(exam, reqUser) {
  if (reqUser.role === "ADMIN") {
    return true;
  }

  if (reqUser.role === "EXAM_BOARD") {
    // EXAM_BOARD can manage official exams they created or all official exams not owned by a normal teacher
    if (
      exam.createdByUserId === reqUser.id ||
      (!exam.teacherId && ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam.examType))
    ) {
      return true;
    }
  }

  if (reqUser.role === "TEACHER") {
    const teacher = await getTeacherProfile(reqUser.id);
    if ((exam.teacherId && exam.teacherId === teacher.id) || exam.createdByUserId === reqUser.id) {
      return true;
    }
  }

  throw new AppError(
    "Bạn không có quyền chỉnh sửa kỳ thi này. Chỉ Quản trị viên, Ban khảo thí hoặc Giáo viên trực tiếp tạo đề mới có quyền thay đổi cấu hình kỳ thi.",
    403,
    "EXAM_MANAGEMENT_DENIED"
  );
}

// =====================================================
// EXAM CRUD
// =====================================================

export async function createExam(data, reqUser) {
  let teacherId = null;
  const createdByUserId = reqUser.id;
  let finalExamType = data.examType || "REGULAR";

  if (reqUser.role === "TEACHER") {
    const teacher = await getTeacherProfile(reqUser.id);
    teacherId = teacher.id;

    // 1. Mandatory Primary Subject Check
    if (!teacher.primarySubjectId) {
      throw new AppError(
        "Tài khoản giáo viên chưa được cấu hình môn học chuyên môn chính. Vui lòng liên hệ Quản trị viên để được phân công trước khi tạo bài kiểm tra.",
        403,
        "PRIMARY_SUBJECT_REQUIRED"
      );
    }

    if (data.subjectId !== teacher.primarySubjectId) {
      throw new AppError(
        "Giáo viên chỉ được phép tạo bài kiểm tra cho môn chuyên môn chính của mình.",
        403,
        "SUBJECT_MISMATCH"
      );
    }

    // 2. Exam Type Restriction: Only REGULAR or MIN_15
    if (finalExamType !== "REGULAR" && finalExamType !== "MIN_15") {
      throw new AppError(
        "Giáo viên chỉ được phép tạo bài kiểm tra Thường xuyên hoặc 15 phút.",
        403,
        "EXAM_TYPE_NOT_ALLOWED"
      );
    }

    // 3. Single Class Restriction
    const classIds = Array.isArray(data.classIds) && data.classIds.length > 0
      ? data.classIds
      : (data.classId ? [data.classId] : []);

    if (classIds.length === 0) {
      throw new AppError(
        "Vui lòng chọn 1 lớp học cụ thể để tạo bài kiểm tra.",
        400,
        "SINGLE_CLASS_REQUIRED"
      );
    }

    if (classIds.length > 1) {
      throw new AppError(
        "Giáo viên chỉ có thể tạo bài kiểm tra cho đúng 1 lớp học cụ thể.",
        400,
        "SINGLE_CLASS_REQUIRED"
      );
    }

    const targetClassId = classIds[0];

    // Xác thực phân công giảng dạy (nếu giáo viên đã có phân công trong hệ thống)
    const totalAssignments = await prisma.teachingAssignment.count({
      where: { teacherId: teacher.id },
    });

    if (totalAssignments > 0) {
      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          teacherId: teacher.id,
          subjectId: data.subjectId,
          classId: targetClassId,
        },
      });
      if (!assignment) {
        throw new AppError(
          "Bạn chỉ có thể tạo bài kiểm tra cho lớp và môn học mà bạn được phân công giảng dạy.",
          403,
          "TEACHING_ASSIGNMENT_REQUIRED"
        );
      }
    }
  } else if (reqUser.role === "EXAM_BOARD") {
    // EXAM_BOARD creates official examinations
    if (finalExamType === "REGULAR" || finalExamType === "MIN_15") {
      throw new AppError(
        "Ban khảo thí chỉ phụ trách các kỳ thi chính quy (tối thiểu 45 phút, giữa kỳ, cuối kỳ).",
        400,
        "OFFICIAL_EXAM_TYPE_REQUIRED"
      );
    }
    teacherId = null;
  } else if (reqUser.role === "ADMIN") {
    if (data.teacherId) {
      teacherId = data.teacherId;
    } else {
      const adminTeacher = await prisma.teacher.findUnique({
        where: { userId: reqUser.id },
      });
      teacherId = adminTeacher ? adminTeacher.id : null;
    }
  } else {
    throw new AppError(
      "Bạn không có quyền khởi tạo kỳ thi.",
      403,
      "FORBIDDEN"
    );
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
      createdByUserId,
      subjectId: data.subjectId,
      classId: primaryClassId,
      gradeId: data.gradeId ?? null,
      durationMinutes: data.durationMinutes ?? 45,
      sheetPreset: data.sheetPreset ?? "PRESET_45MIN_40Q",
      examType: finalExamType,
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
      createdByUser: { select: { id: true, fullName: true, role: true } },
    },
  });
}

export async function listExams(query, reqUser) {
  const { status, subjectId, classId, gradeId, examType, publicationApprovalStatus, search, page = 1, limit = 20 } = query;
  const where = {};
  const andClauses = [];

  if (reqUser.role === "TEACHER") {
    const teacher = await getTeacherProfile(reqUser.id);
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true, subjectId: true },
    });
    const assignedClassIds = assignments.map((a) => a.classId);
    const assignedSubjectIds = [...new Set(assignments.map((a) => a.subjectId))];

    andClauses.push({
      OR: [
        { teacherId: teacher.id },
        { createdByUserId: reqUser.id },
        ...(assignedSubjectIds.length > 0 && assignedClassIds.length > 0
          ? [
              {
                subjectId: { in: assignedSubjectIds },
                OR: [
                  { classId: { in: assignedClassIds } },
                  { examClasses: { some: { classId: { in: assignedClassIds } } } },
                ],
              },
            ]
          : []),
      ],
    });
  } else if (reqUser.role === "EXAM_BOARD") {
    andClauses.push({
      OR: [
        { createdByUserId: reqUser.id },
        { examType: { in: ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"] } },
      ],
    });
  }

  if (status) where.status = status;
  if (examType) where.examType = examType;
  if (publicationApprovalStatus) where.publicationApprovalStatus = publicationApprovalStatus;
  if (subjectId) where.subjectId = subjectId;
  if (gradeId) where.gradeId = gradeId;
  if (classId) {
    andClauses.push({
      OR: [
        { classId },
        { examClasses: { some: { classId } } },
      ],
    });
  }
  if (search) where.title = { contains: search, mode: "insensitive" };

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

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
        createdByUser: { select: { id: true, fullName: true, role: true } },
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
  await assertExamManageAccess(exam, reqUser);

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
      "examType",
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

  if (reqUser.role === "TEACHER") {
    const teacher = await getTeacherProfile(reqUser.id);
    if (data.subjectId && data.subjectId !== teacher.primarySubjectId) {
      throw new AppError(
        "Giáo viên chỉ được phép gán kỳ thi cho môn chuyên môn chính của mình.",
        403,
        "SUBJECT_MISMATCH"
      );
    }
    if (data.examType && data.examType !== "REGULAR" && data.examType !== "MIN_15") {
      throw new AppError(
        "Giáo viên chỉ được phép tạo hoặc cập nhật bài kiểm tra Thường xuyên hoặc 15 phút.",
        403,
        "EXAM_TYPE_NOT_ALLOWED"
      );
    }
  } else if (reqUser.role === "EXAM_BOARD") {
    if (data.examType && (data.examType === "REGULAR" || data.examType === "MIN_15")) {
      throw new AppError(
        "Ban khảo thí chỉ phụ trách các kỳ thi chính quy (tối thiểu 45 phút, giữa kỳ, cuối kỳ).",
        400,
        "OFFICIAL_EXAM_TYPE_REQUIRED"
      );
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
    examType: data.examType !== undefined ? data.examType : undefined,
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
  await assertExamManageAccess(exam, reqUser);
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
  await assertExamManageAccess(sourceExam, reqUser);

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
        createdByUserId: reqUser.id,
        examType: sourceExam.examType,
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
        createdByUser: { select: { id: true, fullName: true, role: true } },
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
  await assertExamManageAccess(exam, reqUser);

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
  await assertExamManageAccess(exam, reqUser);
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
  await assertExamManageAccess(exam, reqUser);
  if (exam.status !== "CLOSED") {
    throw new AppError(
      "Chi co the archive Exam o trang thai CLOSED.",
      409,
      "EXAM_INVALID_STATUS"
    );
  }
  return prisma.exam.update({ where: { id: examId }, data: { status: "ARCHIVED" } });
}