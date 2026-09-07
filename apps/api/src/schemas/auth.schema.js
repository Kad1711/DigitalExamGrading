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