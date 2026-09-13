import { z } from "zod";

export const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên lớp không được để trống.")
    .max(50, "Tên lớp tối đa 50 ký tự."),
  gradeId: z.string().min(1, "Vui lòng chọn khối học."),
});

export const createBatchClassesSchema = z.object({
  gradeId: z.string().min(1, "Vui lòng chọn khối học."),
  names: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tên lớp không được để trống.")
        .max(50, "Tên lớp tối đa 50 ký tự.")
    )
    .min(1, "Vui lòng nhập ít nhất một tên lớp.")
    .max(100, "Mỗi lần tạo tối đa 100 lớp học."),
});

export const updateClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên lớp không được để trống.")
    .max(50, "Tên lớp tối đa 50 ký tự.")
    .optional(),
  gradeId: z.string().min(1, "Vui lòng chọn khối học.").optional(),
});

export const createStudentSchema = z.object({
  studentCode: z
    .string()
    .trim()
    .min(1, "Mã học sinh/SBD không được để trống.")
    .max(50, "Mã học sinh/SBD tối đa 50 ký tự."),
  fullName: z
    .string()
    .trim()
    .min(1, "Họ và tên không được để trống.")
    .max(100, "Họ và tên tối đa 100 ký tự."),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email("Email không hợp lệ.").optional().nullable().or(z.literal("")),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự.").optional().nullable().or(z.literal("")),
});

export const updateStudentSchema = z.object({
  studentCode: z
    .string()
    .trim()
    .min(1, "Mã học sinh/SBD không được để trống.")
    .max(50, "Mã học sinh/SBD tối đa 50 ký tự.")
    .optional(),
  fullName: z
    .string()
    .trim()
    .min(1, "Họ và tên không được để trống.")
    .max(100, "Họ và tên tối đa 100 ký tự.")
    .optional(),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email("Email không hợp lệ.").optional().nullable().or(z.literal("")),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự.").optional().nullable().or(z.literal("")),
});

export const importStudentsConfigSchema = z.object({
  headerRowIndex: z.coerce.number().int().min(1).default(1),
  studentCodeCol: z.coerce.number().int().min(1, "Vui lòng chọn cột Mã học sinh / Số báo danh."),
  fullNameCol: z.coerce.number().int().min(1).optional().nullable(),
  lastNameCol: z.coerce.number().int().min(1).optional().nullable(),
  firstNameCol: z.coerce.number().int().min(1).optional().nullable(),
  dobCol: z.coerce.number().int().min(1).optional().nullable(),
  genderCol: z.coerce.number().int().min(1).optional().nullable(),
}).refine(
  (data) => data.fullNameCol || (data.lastNameCol && data.firstNameCol),
  {
    message: "Vui lòng chọn cột Họ và tên (hoặc cả 2 cột Họ đệm và Tên).",
    path: ["fullNameCol"],
  }
);
