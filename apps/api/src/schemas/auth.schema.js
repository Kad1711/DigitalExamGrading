import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email la bat buoc." })
    .email("Email khong dung dinh dang."),
  password: z
    .string({ required_error: "Mat khau la bat buoc." })
    .min(6, "Mat khau phai co it nhat 6 ky tu."),
});

export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: "refreshToken la bat buoc." })
    .min(1, "refreshToken khong duoc de trong."),
});

export const logoutSchema = z.object({
  refreshToken: z
    .string({ required_error: "refreshToken la bat buoc." })
    .min(1, "refreshToken khong duoc de trong."),
});

export const registerTeacherSchema = z.object({
  fullName: z
    .string({ required_error: "Họ và tên là bắt buộc." })
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự."),
  email: z
    .string({ required_error: "Email là bắt buộc." })
    .trim()
    .email("Email không đúng định dạng."),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  teacherCode: z
    .string()
    .trim()
    .optional()
    .nullable(),
  password: z
    .string({ required_error: "Mật khẩu là bắt buộc." })
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
});