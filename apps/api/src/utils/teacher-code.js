import prisma from "../config/prisma.js";

/**
 * Danh sách các môn học chuẩn và tiền tố mã giáo viên tương ứng
 * Ví dụ: Văn -> GVVAN01, GVVAN02; Toán -> GVTOAN01, GVTOAN02...
 */
export const SUBJECT_PREFIX_MAP = {
  VAN: "GVVAN",
  NGUVAN: "GVVAN",
  TOAN: "GVTOAN",
  ANH: "GVANH",
  TIENGANH: "GVANH",
  LY: "GVLY",
  VATLY: "GVLY",
  HOA: "GVHOA",
  HOAHOC: "GVHOA",
  SINH: "GVSINH",
  SINHHOC: "GVSINH",
  SU: "GVSU",
  LICHSU: "GVSU",
  DIA: "GVDIA",
  DIALY: "GVDIA",
  TIN: "GVTIN",
  TINHOC: "GVTIN",
  CONGNGHE: "GVCN",
  CN: "GVCN",
  GDKTPL: "GVGDCD",
  GDCD: "GVGDCD",
};

export const STANDARD_SUBJECTS = [
  { code: "TOAN", name: "Toán", prefix: "GVTOAN" },
  { code: "NGUVAN", name: "Ngữ văn", prefix: "GVVAN" },
  { code: "TIENGANH", name: "Tiếng Anh", prefix: "GVANH" },
  { code: "VATLY", name: "Vật lý", prefix: "GVLY" },
  { code: "HOAHOC", name: "Hóa học", prefix: "GVHOA" },
  { code: "SINHHOC", name: "Sinh học", prefix: "GVSINH" },
  { code: "LICHSU", name: "Lịch sử", prefix: "GVSU" },
  { code: "DIALY", name: "Địa lý", prefix: "GVDIA" },
  { code: "TINHOC", name: "Tin học", prefix: "GVTIN" },
  { code: "GDKTPL", name: "GDKT & Pháp luật (GDCD)", prefix: "GVGDCD" },
  { code: "CONGNGHE", name: "Công nghệ", prefix: "GVCN" },
];

/**
 * Loại bỏ dấu tiếng Việt để so khớp môn học
 */
function removeVietnameseTones(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Xác định tiền tố mã giáo viên theo môn học
 */
export function getSubjectPrefix(subjectInput) {
  if (!subjectInput || typeof subjectInput !== "string") {
    return "GV";
  }

  const clean = removeVietnameseTones(subjectInput).toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Kiểm tra nếu đã bắt đầu bằng GV
  if (clean.startsWith("GV") && clean.length > 2) {
    return clean;
  }

  // Tìm trong map
  if (SUBJECT_PREFIX_MAP[clean]) {
    return SUBJECT_PREFIX_MAP[clean];
  }

  // Tìm theo partial match
  if (clean.includes("VAN")) return "GVVAN";
  if (clean.includes("TOAN")) return "GVTOAN";
  if (clean.includes("ANH")) return "GVANH";
  if (clean.includes("LY") || clean.includes("VAT")) return "GVLY";
  if (clean.includes("HOA")) return "GVHOA";
  if (clean.includes("SINH")) return "GVSINH";
  if (clean.includes("SU") || clean.includes("LICH")) return "GVSU";
  if (clean.includes("DIA")) return "GVDIA";
  if (clean.includes("TIN")) return "GVTIN";
  if (clean.includes("CONGNGHE") || clean.includes("CN")) return "GVCN";
  if (clean.includes("PHAPLUAT") || clean.includes("GDKT") || clean.includes("GDCD")) return "GVGDCD";

  return `GV${clean.slice(0, 4)}`;
}

/**
 * Tự động sinh mã giáo viên tiếp theo theo môn học
 * Logic tăng tiến: tìm số lớn nhất của tiền tố hiện có + 1, định dạng 2 chữ số (01, 02, ...)
 * Khi giáo viên cũ (ví dụ GVVAN01) bị xóa, hệ thống cứ tiếp tục tiến lên (GVVAN02, GVVAN03, ...)
 */
export async function getNextTeacherCode(subjectInput, tx = prisma) {
  const prefix = getSubjectPrefix(subjectInput);

  // Lấy tất cả giáo viên có mã bắt đầu bằng prefix
  const teachers = await tx.teacher.findMany({
    where: {
      teacherCode: {
        startsWith: prefix,
        mode: "insensitive",
      },
    },
    select: { teacherCode: true },
  });

  const regex = new RegExp(`^${prefix}(\\d+)$`, "i");
  const numbers = [];

  for (const t of teachers) {
    const match = t.teacherCode.match(regex);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) numbers.push(n);
    }
  }

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(2, "0");

  return `${prefix}${padded}`;
}
