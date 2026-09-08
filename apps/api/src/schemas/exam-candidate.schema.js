import { z } from "zod";

export const assignCandidateSchema = z.object({
  studentId: z.string().min(1, "Vui lòng chọn học sinh."),
  studentNumber: z
    .string()
    .regex(/^\d{1,10}$/, "Số báo danh phải là dãy chữ số.")
    .min(1, "Số báo danh không được để trống."),
});
