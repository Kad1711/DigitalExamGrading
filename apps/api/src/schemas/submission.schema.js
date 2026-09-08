import { z } from "zod";

export const reviewAnswersSchema = z.object({
  reviews: z
    .array(
      z.object({
        questionNumber: z.number().int().min(1),
        resolution: z.enum(["ANSWER", "BLANK", "MULTIPLE_INVALID", "UNRESOLVED"], {
          errorMap: () => ({
            message: "Loại xác nhận phải là ANSWER, BLANK, MULTIPLE_INVALID, hoặc UNRESOLVED.",
          }),
        }),
        answer: z
          .enum(["A", "B", "C", "D"], {
            errorMap: () => ({ message: "Phương án phải là A, B, C hoặc D." }),
          })
          .optional()
          .nullable(),
      })
    )
    .min(1, "Danh sách xác nhận không được rỗng."),
});

export const reviewIdentitySchema = z.object({
  studentNumber: z
    .string()
    .regex(/^\d{6}$/, "Số báo danh phải bao gồm đúng 6 chữ số."),
});
