import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

// STRICT SAFETY GUARD: Never run in production
if (process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL SAFETY ERROR: Demo seed script cannot run in production environment.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const DEMO_PASSWORD = "Admin@123";

async function main() {
  console.log("Starting THCS V2 database seed...");

  // =====================================================
  // 1. GRADES (Khối 6, 7, 8, 9 strictly)
  // =====================================================
  const grades = [
    { level: 6, name: "Khối 6" },
    { level: 7, name: "Khối 7" },
    { level: 8, name: "Khối 8" },
    { level: 9, name: "Khối 9" },
  ];

  const gradeMap = {};
  for (const grade of grades) {
    const record = await prisma.grade.upsert({
      where: { level: grade.level },
      update: { name: grade.name },
      create: grade,
    });
    gradeMap[grade.level] = record;
  }
  console.log("Grades 6, 7, 8, 9 seeded.");

  // Remove any legacy THPT grades (10, 11, 12) if present
  await prisma.grade.deleteMany({
    where: { level: { notIn: [6, 7, 8, 9] } },
  });

  // =====================================================
  // 2. ACADEMIC YEAR & SEMESTERS
  // =====================================================
  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: { name: "2026-2027" },
  });

  const semesters = ["Học kỳ 1", "Học kỳ 2"];
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
  console.log("Academic year 2026-2027 & Semesters seeded.");

  // =====================================================
  // 3. SUBJECTS (THCS curriculum)
  // =====================================================
  const subjectsData = [
    { code: "TOAN", name: "Toán" },
    { code: "NGUVAN", name: "Ngữ văn" },
    { code: "TIENGANH", name: "Tiếng Anh" },
    { code: "KHTN", name: "Khoa học tự nhiên" },
    { code: "LSDLS", name: "Lịch sử và Địa lý" },
    { code: "GDCD", name: "Giáo dục công dân" },
    { code: "TINHOC", name: "Tin học" },
    { code: "CONGNGHE", name: "Công nghệ" },
  ];

  const subjectMap = {};
  for (const sub of subjectsData) {
    const record = await prisma.subject.upsert({
      where: { code: sub.code },
      update: { name: sub.name },
      create: sub,
    });
    subjectMap[sub.code] = record;
  }
  console.log("THCS Subjects seeded.");

  // =====================================================
  // 4. CLASSES (6A1, 7A1, 8A1, 9A1)
  // =====================================================
  const classesData = [
    { name: "6A1", level: 6 },
    { name: "7A1", level: 7 },
    { name: "8A1", level: 8 },
    { name: "9A1", level: 9 },
  ];

  const classMap = {};
  for (const cls of classesData) {
    const grade = gradeMap[cls.level];
    const record = await prisma.class.upsert({
      where: {
        name_academicYearId: {
          name: cls.name,
          academicYearId: academicYear.id,
        },
      },
      update: { gradeId: grade.id },
      create: {
        name: cls.name,
        gradeId: grade.id,
        academicYearId: academicYear.id,
      },
    });
    classMap[cls.name] = record;
  }
  console.log("Classes 6A1, 7A1, 8A1, 9A1 seeded.");

  // Password hash for all demo accounts
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // =====================================================
  // 5. DEMO ACCOUNTS (Exactly 6 roles)
  // =====================================================

  // 1. SUPER_ADMIN
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@digitalexam.local" },
    update: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      fullName: "Quản trị viên Hệ thống",
      passwordHash,
    },
    create: {
      email: "admin@digitalexam.local",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      fullName: "Quản trị viên Hệ thống",
      passwordHash,
    },
  });

  // 2. PRINCIPAL (Hiệu trưởng)
  const principal = await prisma.user.upsert({
    where: { email: "hieutruong@digitalexam.local" },
    update: {
      role: "PRINCIPAL",
      status: "ACTIVE",
      fullName: "Trần Văn Hiệu Trưởng",
      passwordHash,
    },
    create: {
      email: "hieutruong@digitalexam.local",
      role: "PRINCIPAL",
      status: "ACTIVE",
      fullName: "Trần Văn Hiệu Trưởng",
      passwordHash,
    },
  });

  // 3. VICE_PRINCIPAL (Hiệu phó chuyên môn)
  const vicePrincipal = await prisma.user.upsert({
    where: { email: "hieupho@digitalexam.local" },
    update: {
      role: "VICE_PRINCIPAL",
      status: "ACTIVE",
      fullName: "Lê Thị Hiệu Phó",
      passwordHash,
    },
    create: {
      email: "hieupho@digitalexam.local",
      role: "VICE_PRINCIPAL",
      status: "ACTIVE",
      fullName: "Lê Thị Hiệu Phó",
      passwordHash,
    },
  });

  // 4. EXAM_OFFICER (Cán bộ khảo thí)
  const examOfficer = await prisma.user.upsert({
    where: { email: "khaothi@digitalexam.local" },
    update: {
      role: "EXAM_OFFICER",
      status: "ACTIVE",
      fullName: "Phạm Văn Khảo Thí",
      passwordHash,
    },
    create: {
      email: "khaothi@digitalexam.local",
      role: "EXAM_OFFICER",
      status: "ACTIVE",
      fullName: "Phạm Văn Khảo Thí",
      passwordHash,
    },
  });

  // 5. TEACHER (Tổ trưởng Toán - Subject Leader)
  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@digitalexam.local" },
    update: {
      role: "TEACHER",
      status: "ACTIVE",
      fullName: "Nguyễn Văn Toán",
      passwordHash,
    },
    create: {
      email: "teacher@digitalexam.local",
      role: "TEACHER",
      status: "ACTIVE",
      fullName: "Nguyễn Văn Toán",
      passwordHash,
    },
  });

  const teacherProfile = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {
      fullName: "Nguyễn Văn Toán",
      teacherCode: "GV001",
      title: "Tổ trưởng chuyên môn",
      isSubjectLeader: true,
      primarySubjectId: subjectMap["TOAN"].id,
    },
    create: {
      userId: teacherUser.id,
      fullName: "Nguyễn Văn Toán",
      teacherCode: "GV001",
      title: "Tổ trưởng chuyên môn",
      isSubjectLeader: true,
      primarySubjectId: subjectMap["TOAN"].id,
    },
  });

  // Assign Teacher 1 to 6A1 and 7A1 for TOAN
  for (const clsName of ["6A1", "7A1"]) {
    await prisma.teachingAssignment.upsert({
      where: {
        teacherId_classId_subjectId_academicYearId: {
          teacherId: teacherProfile.id,
          classId: classMap[clsName].id,
          subjectId: subjectMap["TOAN"].id,
          academicYearId: academicYear.id,
        },
      },
      update: {},
      create: {
        teacherId: teacherProfile.id,
        classId: classMap[clsName].id,
        subjectId: subjectMap["TOAN"].id,
        academicYearId: academicYear.id,
      },
    });
  }

  // Teacher 2 (Giáo viên Văn - bộ môn)
  const teacher2User = await prisma.user.upsert({
    where: { email: "teacher2@digitalexam.local" },
    update: {
      role: "TEACHER",
      status: "ACTIVE",
      fullName: "Trần Thị Văn",
      passwordHash,
    },
    create: {
      email: "teacher2@digitalexam.local",
      role: "TEACHER",
      status: "ACTIVE",
      fullName: "Trần Thị Văn",
      passwordHash,
    },
  });

  const teacher2Profile = await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: {
      fullName: "Trần Thị Văn",
      teacherCode: "GV002",
      title: "Giáo viên bộ môn",
      isSubjectLeader: false,
      primarySubjectId: subjectMap["NGUVAN"].id,
    },
    create: {
      userId: teacher2User.id,
      fullName: "Trần Thị Văn",
      teacherCode: "GV002",
      title: "Giáo viên bộ môn",
      isSubjectLeader: false,
      primarySubjectId: subjectMap["NGUVAN"].id,
    },
  });

  // Assign Teacher 2 to 6A1 for NGUVAN
  await prisma.teachingAssignment.upsert({
    where: {
      teacherId_classId_subjectId_academicYearId: {
        teacherId: teacher2Profile.id,
        classId: classMap["6A1"].id,
        subjectId: subjectMap["NGUVAN"].id,
        academicYearId: academicYear.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher2Profile.id,
      classId: classMap["6A1"].id,
      subjectId: subjectMap["NGUVAN"].id,
      academicYearId: academicYear.id,
    },
  });

  // 6. STUDENT (Học sinh lớp 6A1)
  const studentUser = await prisma.user.upsert({
    where: { email: "student@digitalexam.local" },
    update: {
      role: "STUDENT",
      status: "ACTIVE",
      fullName: "Nguyễn Hoàng Nam",
      passwordHash,
    },
    create: {
      email: "student@digitalexam.local",
      role: "STUDENT",
      status: "ACTIVE",
      fullName: "Nguyễn Hoàng Nam",
      passwordHash,
    },
  });

  const studentProfile = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      fullName: "Nguyễn Hoàng Nam",
      studentCode: "HS0001",
    },
    create: {
      userId: studentUser.id,
      fullName: "Nguyễn Hoàng Nam",
      studentCode: "HS0001",
    },
  });

  await prisma.studentEnrollment.upsert({
    where: {
      studentId_academicYearId: {
        studentId: studentProfile.id,
        academicYearId: academicYear.id,
      },
    },
    update: {
      classId: classMap["6A1"].id,
    },
    create: {
      studentId: studentProfile.id,
      classId: classMap["6A1"].id,
      academicYearId: academicYear.id,
    },
  });

  console.log("\n=======================================================");
  console.log("THCS V2 DEMO ACCOUNTS SEEDED SUCCESSFULLY");
  console.log("Default Password for all: Admin@123");
  console.log("-------------------------------------------------------");
  console.log("1. SUPER_ADMIN:    admin@digitalexam.local");
  console.log("2. PRINCIPAL:      hieutruong@digitalexam.local");
  console.log("3. VICE_PRINCIPAL: hieupho@digitalexam.local");
  console.log("4. EXAM_OFFICER:   khaothi@digitalexam.local");
  console.log("5. TEACHER (Lead): teacher@digitalexam.local (Toán, Tổ trưởng)");
  console.log("6. TEACHER:        teacher2@digitalexam.local (Ngữ văn)");
  console.log("7. STUDENT:        student@digitalexam.local (Lớp 6A1)");
  console.log("=======================================================\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });