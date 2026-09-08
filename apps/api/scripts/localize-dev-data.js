/**
 * One-off / Idempotent Development Data Localization Script
 *
 * Localizes existing development & test records in PostgreSQL to professional Vietnamese.
 *
 * SAFETY GUARANTEES:
 * - Runs ONLY when NODE_ENV !== "production".
 * - Renames ONLY exact known development/test exam titles.
 * - NEVER deletes any records.
 * - NEVER alters IDs, AnswerKeys, ExamCodes, templates, scoring, or status.
 * - NEVER touches unknown teacher-created exam titles.
 * - Idempotent: safe to run multiple times without duplicating or corrupting data.
 */

import "dotenv/config";
import prisma from "../src/config/prisma.js";

if (process.env.NODE_ENV === "production") {
  console.error("⛔ ABORT: localize-dev-data.js cannot run in production environment.");
  process.exit(1);
}

// Known development / test exam titles mapped to professional Vietnamese titles
const EXAM_TITLE_LOCALIZATION_MAP = {
  // Required core test titles
  "Exam 40 Questions - 1 Page": "Kiểm tra 1 tiết Toán 11 - 40 câu",
  "Exam EQUAL 30 questions": "Kiểm tra Toán 11 - 30 câu",
  "Exam EQUAL 50 questions": "Kiểm tra Toán 11 - 50 câu",
  "Exam EQUAL 40 questions": "Kiểm tra Toán 11 - 40 câu - Mẫu 2",
  "Exam CUSTOM 4 questions": "Kiểm tra Toán - 4 câu - Điểm tùy chỉnh",
  "Exam Test CUSTOM Import": "Kiểm thử nhập đáp án - Điểm tùy chỉnh",
  "Test EDGE CASE 1 question / 10 points EQUAL": "Kiểm thử 1 câu - Thang điểm 10",
  "Test CUSTOM (2+2+3+3=10)": "Kiểm thử điểm tùy chỉnh 2+2+3+3",
  "Title moi sau khi published": "Kiểm tra Vật lý 11 - Sau phát hành",

  // Other known local test records
  "Exam 60 Questions - 2 Pages": "Kiểm tra Học kỳ Toán 11 - 60 câu (2 trang)",
  "Exam 50 Questions - 1 Page": "Kiểm tra 1 tiết Toán 11 - 50 câu",
  "Exam Non-numeric Code": "Kiểm thử mã đề ký tự - 10 câu",
  "Exam Test Import - 40 EQUAL": "Kiểm thử nhập đáp án - 40 câu chia đều",
  "Test CUSTOM (2+2+2+3=9)": "Kiểm thử điểm tùy chỉnh 2+2+2+3",
  "Test EQUAL 50 questions": "Kiểm tra thử nghiệm - 50 câu",
  "Ky thi Tong Hop Regression Phase 3": "Kỳ thi Tổng hợp Kiểm thử - 40 câu",
  "Ky thi Toan 11 - 40 cau EQUAL": "Kỳ thi Toán 11 - 40 câu chia đều",
  "Test publish khong du AnswerKey": "Kiểm thử phát hành thiếu đáp án",
  "Test CUSTOM FAIL": "Kiểm thử điểm tùy chỉnh không hợp lệ",
  "Test CUSTOM 4 cau": "Kiểm tra Toán - 4 câu - Tùy chỉnh mẫu 2",
  "Test EQUAL 50 cau": "Kiểm tra thử nghiệm 50 câu mẫu 2",
};

// Known seeded subjects to update with accents
const SUBJECT_LOCALIZATION_MAP = {
  TOAN: "Toán",
  NGUVAN: "Ngữ văn",
  TIENGANH: "Tiếng Anh",
  VATLY: "Vật lý",
  HOAHOC: "Hóa học",
  SINHHOC: "Sinh học",
  LICHSU: "Lịch sử",
  DIALY: "Địa lý",
  GDKTPL: "Giáo dục Kinh tế và Pháp luật",
  TINHOC: "Tin học",
  CONGNGHE: "Công nghệ",
};

// Known seeded grades
const GRADE_LOCALIZATION_MAP = {
  10: "Khối 10",
  11: "Khối 11",
  12: "Khối 12",
};

// Known development teachers
const TEACHER_LOCALIZATION_MAP = {
  TCH001: "Giáo viên Development",
  TCH002: "Giáo viên B Development",
};

async function localizeDevData() {
  console.log("=== BẮT ĐẦU CHUẨN HÓA TIẾNG VIỆT CHO DỮ LIỆU PHÁT TRIỂN ===");
  console.log("Môi trường: " + (process.env.NODE_ENV || "development"));

  let totalExamsUpdated = 0;
  let totalSubjectsUpdated = 0;
  let totalGradesUpdated = 0;
  let totalTeachersUpdated = 0;

  // 1. Localize Exam Titles
  console.log("\n1. Cập nhật tiêu đề các kỳ thi thử nghiệm (Exam)...");
  for (const [oldTitle, newTitle] of Object.entries(EXAM_TITLE_LOCALIZATION_MAP)) {
    const res = await prisma.exam.updateMany({
      where: { title: oldTitle },
      data: { title: newTitle },
    });
    if (res.count > 0) {
      console.log(`   ✓ Đã đổi "${oldTitle}" -> "${newTitle}" (${res.count} bản ghi)`);
      totalExamsUpdated += res.count;
    }
  }
  console.log(`   => Tổng cộng: ${totalExamsUpdated} bản ghi Exam đã được cập nhật.`);

  // 2. Localize Subjects
  console.log("\n2. Cập nhật danh mục Môn học (Subject)...");
  for (const [code, newName] of Object.entries(SUBJECT_LOCALIZATION_MAP)) {
    const existing = await prisma.subject.findUnique({ where: { code } });
    if (existing && existing.name !== newName) {
      await prisma.subject.update({
        where: { code },
        data: { name: newName },
      });
      console.log(`   ✓ Môn [${code}]: "${existing.name}" -> "${newName}"`);
      totalSubjectsUpdated++;
    }
  }
  console.log(`   => Tổng cộng: ${totalSubjectsUpdated} môn học đã được cập nhật dấu tiếng Việt.`);

  // 3. Localize Grades
  console.log("\n3. Cập nhật danh mục Khối lớp (Grade)...");
  for (const [levelStr, newName] of Object.entries(GRADE_LOCALIZATION_MAP)) {
    const level = Number(levelStr);
    const existing = await prisma.grade.findUnique({ where: { level } });
    if (existing && existing.name !== newName) {
      await prisma.grade.update({
        where: { level },
        data: { name: newName },
      });
      console.log(`   ✓ Khối [${level}]: "${existing.name}" -> "${newName}"`);
      totalGradesUpdated++;
    }
  }
  console.log(`   => Tổng cộng: ${totalGradesUpdated} khối lớp đã được cập nhật.`);

  // 4. Localize Teachers
  console.log("\n4. Cập nhật hồ sơ Giáo viên (Teacher)...");
  for (const [teacherCode, newFullName] of Object.entries(TEACHER_LOCALIZATION_MAP)) {
    const existing = await prisma.teacher.findUnique({ where: { teacherCode } });
    if (existing && existing.fullName !== newFullName) {
      await prisma.teacher.update({
        where: { teacherCode },
        data: { fullName: newFullName },
      });
      console.log(`   ✓ Giáo viên [${teacherCode}]: "${existing.fullName}" -> "${newFullName}"`);
      totalTeachersUpdated++;
    }
  }
  console.log(`   => Tổng cộng: ${totalTeachersUpdated} giáo viên đã được cập nhật.`);

  console.log("\n=== TỔNG KẾT QUÁ TRÌNH CHUẨN HÓA DỮ LIỆU ===");
  console.log(`- Exams:     ${totalExamsUpdated}`);
  console.log(`- Subjects:  ${totalSubjectsUpdated}`);
  console.log(`- Grades:    ${totalGradesUpdated}`);
  console.log(`- Teachers:  ${totalTeachersUpdated}`);
  console.log("Hoàn tất an toàn. Không thay đổi ID, AnswerKey, ExamCode hay Template.\n");
}

localizeDevData()
  .catch((err) => {
    console.error("❌ Lỗi khi chuẩn hóa dữ liệu:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
