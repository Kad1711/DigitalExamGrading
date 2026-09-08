import { z } from "zod";

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Ho va ten khong duoc de trong.")
      .max(100, "Ho va ten khong duoc vuot qua 100 ky tu.")
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

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Vui long nhap mat khau hien tai." })
      .min(1, "Vui long nhap mat khau hien tai."),
    newPassword: z
      .string({ required_error: "Vui long nhap mat khau moi." })
      .min(8, "Mat khau moi phai co it nhat 8 ky tu.")
      .max(100, "Mat khau moi khong duoc vuot qua 100 ky tu."),
  })
  .strip();
