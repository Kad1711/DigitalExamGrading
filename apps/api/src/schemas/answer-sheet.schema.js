import { z } from "zod";

export const createAnswerSheetTemplateSchema = z.object({
  studentNumberDigits: z
    .number({ invalid_type_error: "studentNumberDigits phai la so." })
    .int("studentNumberDigits phai la so nguyen.")
    .min(1, "studentNumberDigits phai >= 1.")
    .max(12, "studentNumberDigits khong vuot qua 12.")
    .default(6)
    .optional(),
  examCodeDigits: z
    .number({ invalid_type_error: "examCodeDigits phai la so." })
    .int("examCodeDigits phai la so nguyen.")
    .min(1, "examCodeDigits phai >= 1.")
    .max(6, "examCodeDigits khong vuot qua 6.")
    .default(3)
    .optional(),
  questionsPerPage: z
    .number({ invalid_type_error: "questionsPerPage phai la so." })
    .int("questionsPerPage phai la so nguyen.")
    .min(10, "questionsPerPage phai >= 10.")
    .max(100, "questionsPerPage khong vuot qua 100.")
    .default(50)
    .optional(),
});