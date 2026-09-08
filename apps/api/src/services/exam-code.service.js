import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, assertExamDraft } from "./exam.service.js";
import { normalizeExamCode } from "../utils/exam-code.js";

export async function createExamCode(examId, code, reqUser) {
  const canonicalCode = normalizeExamCode(code);
  const exam = await assertExamAccess(examId, reqUser);
  assertExamDraft(exam);

  // Kiem tra xem co ma de nao da ton tai sau khi chuan hoa
  const existingCodes = await prisma.examCode.findMany({
    where: { examId },
    select: { code: true },
  });

  const duplicate = existingCodes.some((ec) => {
    try {
      return normalizeExamCode(ec.code) === canonicalCode;
    } catch {
      return ec.code === canonicalCode;
    }
  });

  if (duplicate) {
    throw new AppError(
      `Ma de '${code}' da ton tai trong ky thi nay.`,
      409,
      "EXAM_CODE_DUPLICATE"
    );
  }

  return prisma.examCode.create({ data: { examId, code: canonicalCode } });
}

export async function listExamCodes(examId, reqUser) {
  await assertExamAccess(examId, reqUser);

  return prisma.examCode.findMany({
    where: { examId },
    include: { _count: { select: { answerKeys: true } } },
    orderBy: { code: "asc" },
  });
}

export async function deleteExamCode(examId, codeId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  assertExamDraft(exam);

  const examCode = await prisma.examCode.findUnique({ where: { id: codeId } });
  if (!examCode || examCode.examId !== examId) {
    throw new AppError("Ma de khong ton tai.", 404, "EXAM_CODE_NOT_FOUND");
  }

  await prisma.examCode.delete({ where: { id: codeId } });
}