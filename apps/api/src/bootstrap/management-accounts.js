import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";

const SALT_ROUNDS = 12;

/**
 * THCS V2 Institutional Management Accounts Configuration
 * Super Admin (admin@digitalexam.local) manages system.
 * 3 institutional management roles:
 * - PRINCIPAL (Hiệu trưởng)
 * - VICE_PRINCIPAL (Hiệu phó chuyên môn)
 * - EXAM_OFFICER (Cán bộ khảo thí)
 */
export const MANAGEMENT_ACCOUNTS = [
  {
    email: "hieutruong@digitalexam.local",
    role: "PRINCIPAL",
    fullName: "Trần Văn Hiệu Trưởng",
  },
  {
    email: "hieupho@digitalexam.local",
    role: "VICE_PRINCIPAL",
    fullName: "Lê Thị Hiệu Phó",
  },
  {
    email: "khaothi@digitalexam.local",
    role: "EXAM_OFFICER",
    fullName: "Phạm Văn Khảo Thí",
  },
];

/**
 * Idempotent Bootstrap for the 3 Institutional Management Accounts.
 * Will not overwrite existing passwords or duplicate users.
 */
export async function bootstrapManagementAccounts() {
  const defaultPassword = process.env.DEFAULT_MANAGEMENT_PASSWORD || "Admin@123";

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
