import { z } from "zod";

export const createTeacherSchema = z
  .object({
    fullName: z
      .string({ required_error: "Ho va ten khong duoc de trong." })
      .trim()
      .min(1, "Ho va ten khong duoc de trong.")
      .max(100, "Ho va ten khong duoc vuot qua 100 ky tu."),
    teacherCode: z
      .string({ required_error: "Ma giao vien khong duoc de trong." })
      .trim()
      .min(2, "Ma giao vien phai co it nhat 2 ky tu.")
      .max(20, "Ma giao vien khong duoc vuot qua 20 ky tu."),
    email: z
      .string({ required_error: "Email khong duoc de trong." })
      .trim()
      .email("Email khong hop le.")
      .toLowerCase(),
    initialPassword: z
      .string({ required_error: "Mat khau ban dau khong duoc de trong." })
      .min(8, "Mat khau phai co it nhat 8 ky tu.")
      .max(100, "Mat khau khong duoc vuot qua 100 ky tu."),
    phone: z
      .string()
      .trim()
      .max(20, "So dien thoai khong duoc vuot qua 20 ky tu.")
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  })
  .strip();

export const updateTeacherSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Ho va ten khong duoc de trong.")
      .max(100, "Ho va ten khong duoc vuot qua 100 ky tu.")
      .optional(),
    teacherCode: z
      .string()
      .trim()
      .min(2, "Ma giao vien phai co it nhat 2 ky tu.")
      .max(20, "Ma giao vien khong duoc vuot qua 20 ky tu.")
      .optional(),
    email: z
      .string()
      .trim()
      .email("Email khong hop le.")
      .toLowerCase()
      .optional(),
    phone: z
      .string()
      .trim()
      .max(20, "So dien thoai khong duoc vuot qua 20 ky tu.")
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  })
  .strip();

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string({ required_error: "Mat khau moi khong duoc de trong." })
      .min(8, "Mat khau moi phai co it nhat 8 ky tu.")
      .max(100, "Mat khau khong duoc vuot qua 100 ky tu."),
  })
  .strip();
