import { z } from "zod";
import { normalizeExamCode } from "../utils/exam-code.js";

// =====================================================
// EXAM SCHEMAS
// =====================================================

export const createExamSchema = z.object({
  title: z.string().min(1, "Ten ky thi khong duoc de trong.").max(255),
  description: z.string().max(1000).optional(),
  subjectId: z.string().min(1, "subjectId la bat buoc."),
  classId: z.string().min(1, "classId la bat buoc."),
  questionCount: z
    .number({ invalid_type_error: "questionCount phai la so." })
    .int("questionCount phai la so nguyen.")
    .min(1, "questionCount phai lon hon 0."),
  maxScore: z
    .number({ invalid_type_error: "maxScore phai la so." })
    .positive("maxScore phai lon hon 0.")
    .max(10, "maxScore khong duoc vuot qua 10.")
    .default(10),
  scoringType: z.enum(["EQUAL", "CUSTOM"]).default("EQUAL"),
  allowStudentViewAnswers: z.boolean().default(false),
  allowStudentViewImage: z.boolean().default(false),
});

export const updateExamSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  questionCount: z.number().int().min(1).optional(),
  maxScore: z.number().positive().max(10).optional(),
  scoringType: z.enum(["EQUAL", "CUSTOM"]).optional(),
  allowStudentViewAnswers: z.boolean().optional(),
  allowStudentViewImage: z.boolean().optional(),
});

export const createExamCodeSchema = z.object({
  code: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        try {
          normalizeExamCode(val);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Mã đề phải là số từ 000 đến 999 (tối đa 3 chữ số).",
      }
    )
    .transform((val) => normalizeExamCode(val)),
});

// =====================================================
// ANSWER KEY SCHEMAS
// =====================================================

const equalAnswerSchema = z.object({
  questionNumber: z
    .number({ invalid_type_error: "questionNumber phai la so." })
    .int("questionNumber phai la so nguyen.")
    .min(1, "questionNumber phai >= 1."),
  correctAnswer: z.enum(["A", "B", "C", "D"], {
    errorMap: () => ({ message: "correctAnswer chi duoc la A, B, C, hoac D." }),
  }),
});

const customAnswerSchema = z.object({
  questionNumber: z
    .number({ invalid_type_error: "questionNumber phai la so." })
    .int("questionNumber phai la so nguyen.")
    .min(1, "questionNumber phai >= 1."),
  correctAnswer: z.enum(["A", "B", "C", "D"], {
    errorMap: () => ({ message: "correctAnswer chi duoc la A, B, C, hoac D." }),
  }),
  score: z
    .number({ required_error: "score la bat buoc khi scoringType = CUSTOM." })
    .positive("score phai lon hon 0."),
});

export const putAnswerKeyEqualSchema = z.object({
  answers: z.array(equalAnswerSchema).min(1, "Phai co it nhat 1 dap an."),
});

export const putAnswerKeyCustomSchema = z.object({
  answers: z.array(customAnswerSchema).min(1, "Phai co it nhat 1 dap an."),
});

// =====================================================
// QUERY SCHEMAS
// =====================================================

export const listExamsQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});