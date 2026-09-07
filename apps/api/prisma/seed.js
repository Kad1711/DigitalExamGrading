import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

async function main() {
  console.log("Starting database seed...");

  // =====================================================
  // GRADES
  // =====================================================

  const grades = [
    { level: 10, name: "Khoi 10" },
    { level: 11, name: "Khoi 11" },
    { level: 12, name: "Khoi 12" },
  ];

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { level: grade.level },
      update: { name: grade.name },
      create: grade,
    });
  }

  console.log("Grades seeded.");

  // =====================================================
  // ACADEMIC YEAR
  // =====================================================

  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: { name: "2026-2027" },
  });

  console.log("Academic year seeded.");

  // =====================================================
  // SEMESTERS
  // =====================================================

  const semesters = ["Hoc ky 1", "Hoc ky 2"];

  for (const semesterName of semesters) {
    await prisma.semester.upsert({
      where: {
        academicYearId_name: {
          academicYearId: academicYear.id,
          name: semesterName,
        },
      },
      update: {},
      create: {
        name: semesterName,
        academicYearId: academicYear.id,
      },
    });
  }

  console.log("Semesters seeded.");

  // =====================================================
  // SUBJECTS
  // =====================================================

  const subjects = [
    { code: "TOAN", name: "Toan" },
    { code: "NGUVAN", name: "Ngu van" },
    { code: "TIENGANH", name: "Tieng Anh" },
    { code: "VATLY", name: "Vat ly" },
    { code: "HOAHOC", name: "Hoa hoc" },
    { code: "SINHHOC", name: "Sinh hoc" },
    { code: "LICHSU", name: "Lich su" },
    { code: "DIALY", name: "Dia ly" },
    { code: "GDKTPL", name: "Giao duc Kinh te va Phap luat" },
    { code: "TINHOC", name: "Tin hoc" },
    { code: "CONGNGHE", name: "Cong nghe" },
  ];

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      update: { name: subject.name },
      create: subject,
    });
  }

  console.log("Subjects seeded.");

  // =====================================================
  // DEVELOPMENT ONLY SEED SECTION
  // =====================================================
  if (process.env.NODE_ENV !== "production") {
    console.log("Seeding development data (NODE_ENV !== production)...");

    // Class 11A1 (cho test Exam)
    const grade11 = await prisma.grade.findUnique({ where: { level: 11 } });

    await prisma.class.upsert({
      where: {
        name_academicYearId: {
          name: "11A1",
          academicYearId: academicYear.id,
        },
      },
      update: {},
      create: {
        name: "11A1",
        gradeId: grade11.id,
        academicYearId: academicYear.id,
      },
    });

    console.log("Class 11A1 seeded.");

    // Admin Development Account
    const adminEmail = "admin@digitalexam.local";
    const adminPassword = "Admin@123456";

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      console.log("Admin account created: " + adminEmail);
    } else {
      console.log("Admin account already exists: " + adminEmail);
    }

    // Teacher A Development Account
    const teacherEmail = "teacher@digitalexam.local";
    const teacherPassword = "Teacher@123456";

    let teacherUser = await prisma.user.findUnique({
      where: { email: teacherEmail },
    });

    if (!teacherUser) {
      const passwordHash = await bcrypt.hash(teacherPassword, SALT_ROUNDS);

      teacherUser = await prisma.user.create({
        data: {
          email: teacherEmail,
          passwordHash,
          role: "TEACHER",
          status: "ACTIVE",
        },
      });

      console.log("Teacher user created: " + teacherEmail);
    } else {
      console.log("Teacher user already exists: " + teacherEmail);
    }

    const existingTeacherProfile = await prisma.teacher.findUnique({
      where: { userId: teacherUser.id },
    });

    if (!existingTeacherProfile) {
      await prisma.teacher.create({
        data: {
          userId: teacherUser.id,
          teacherCode: "TCH001",
          fullName: "Giao vien Development",
        },
      });
      console.log("Teacher profile created: TCH001");
    } else {
      console.log("Teacher profile already exists: TCH001");
    }

    // Teacher B Development Account (de test ownership)
    const teacherBEmail = "teacher2@digitalexam.local";

    let teacherBUser = await prisma.user.findUnique({
      where: { email: teacherBEmail },
    });

    if (!teacherBUser) {
      const passwordHash = await bcrypt.hash("Teacher@123456", SALT_ROUNDS);

      teacherBUser = await prisma.user.create({
        data: {
          email: teacherBEmail,
          passwordHash,
          role: "TEACHER",
          status: "ACTIVE",
        },
      });

      console.log("Teacher B user created: " + teacherBEmail);
    } else {
      console.log("Teacher B user already exists: " + teacherBEmail);
    }

    const existingTeacherBProfile = await prisma.teacher.findUnique({
      where: { userId: teacherBUser.id },
    });

    if (!existingTeacherBProfile) {
      await prisma.teacher.create({
        data: {
          userId: teacherBUser.id,
          teacherCode: "TCH002",
          fullName: "Giao vien B Development",
        },
      });
      console.log("Teacher B profile created: TCH002");
    } else {
      console.log("Teacher B profile already exists: TCH002");
    }

    console.log("Database seed completed successfully.");
    console.log("");
    console.log("=== Development Accounts ===");
    console.log("Admin:     admin@digitalexam.local    / Admin@123456");
    console.log("Teacher A: teacher@digitalexam.local  / Teacher@123456");
    console.log("Teacher B: teacher2@digitalexam.local / Teacher@123456");
    console.log("============================");
  } else {
    console.log("Production environment detected. Skipping development accounts & test class seed.");
    console.log("Database core seed completed successfully.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });