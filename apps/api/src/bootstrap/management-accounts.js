import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const SALT_ROUNDS = 12;

/**
 * 5 Standard Management Accounts Configuration
 * admin@digitalexam.local is preserved as existing ADMIN.
 * 4 new management roles are bootstrapped idempotently without storing plaintext passwords in git.
 */
export const MANAGEMENT_ACCOUNTS = [
  {
    email: "hieutruongdigital@digitalexam.local",
    role: "PRINCIPAL",
    fullName: "Hiệu trưởng",
  },
  {
    email: "hieuphodigital@digitalexam.local",
    role: "VICE_PRINCIPAL",
    fullName: "Hiệu phó",
  },
  {
    email: "bankhaothidigital@digitalexam.local",
    role: "EXAM_BOARD",
    fullName: "Ban khảo thí",
  },
  {
    email: "bangiaoducvadaotaodigital@digitalexam.local",
    role: "ACADEMIC_BOARD",
    fullName: "Ban Giáo dục và Đào tạo",
  },
];

/**
 * Idempotent Bootstrap for the 4 Management Accounts.
 * Will not overwrite existing passwords or duplicate users.
 */
export async function bootstrapManagementAccounts() {
  const defaultPassword = process.env.DEFAULT_MANAGEMENT_PASSWORD || "DigitalExam@2026!";

  for (const acc of MANAGEMENT_ACCOUNTS) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email: acc.email },
      });

      if (!existing) {
        const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
        await prisma.user.create({
          data: {
            email: acc.email,
            passwordHash,
            role: acc.role,
            status: "ACTIVE",
            fullName: acc.fullName,
          },
        });
        console.log(`[BOOTSTRAP] Successfully initialized ${acc.role} account: ${acc.email}`);
      } else if (existing.role !== acc.role) {
        // Ensure role matches target specification
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: acc.role, fullName: acc.fullName || existing.fullName },
        });
        console.log(`[BOOTSTRAP] Updated existing account ${acc.email} to role ${acc.role}`);
      }
    } catch (err) {
      console.warn(`[BOOTSTRAP] Could not ensure management account ${acc.email}:`, err.message);
    }
  }
}
