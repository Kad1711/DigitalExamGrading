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

  // Bỏ tiền tố GV nếu có để chuẩn hóa so khớp (ví dụ GVHOAHOC -> HOAHOC, GVTOAN -> TOAN)
  const withoutGV = clean.startsWith("GV") ? clean.slice(2) : clean;

  if (SUBJECT_PREFIX_MAP[withoutGV]) {
    return SUBJECT_PREFIX_MAP[withoutGV];
  }

  if (SUBJECT_PREFIX_MAP[clean]) {
    return SUBJECT_PREFIX_MAP[clean];
  }

  // Tìm theo partial match
  if (withoutGV.includes("VAN")) return "GVVAN";
  if (withoutGV.includes("TOAN")) return "GVTOAN";
  if (withoutGV.includes("ANH")) return "GVANH";
  if (withoutGV.includes("LY") || withoutGV.includes("VAT")) return "GVLY";
  if (withoutGV.includes("HOA")) return "GVHOA";
  if (withoutGV.includes("SINH")) return "GVSINH";
  if (withoutGV.includes("SU") || withoutGV.includes("LICH")) return "GVSU";
  if (withoutGV.includes("DIA")) return "GVDIA";
  if (withoutGV.includes("TIN")) return "GVTIN";
  if (withoutGV.includes("CONGNGHE") || withoutGV.includes("CN")) return "GVCN";
  if (withoutGV.includes("PHAPLUAT") || withoutGV.includes("GDKT") || withoutGV.includes("GDCD")) return "GVGDCD";

  // Nếu chuỗi bắt đầu bằng GV và có nội dung môn hợp lệ
  if (clean.startsWith("GV") && clean.length > 2) {
    return clean;
  }

  return `GV${withoutGV.slice(0, 4) || "01"}`;
}

/**
 * Tự động sinh mã giáo viên tiếp theo theo môn học
 * Logic tăng tiến: tìm số lớn nhất của tiền tố hiện có + 1, định dạng 2 chữ số (01, 02, ...)
 * Khi trường có nhiều giáo viên cùng bộ môn (ví dụ GVHOA01, GVHOA02, GVHOA03...),
 * hệ thống tự động sinh số tăng tiến kế tiếp không bao giờ trùng lặp.
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
  let nextNum = maxNum + 1;
  let candidate = `${prefix}${String(nextNum).padStart(2, "0")}`;

  // Kiểm tra an toàn tuyệt đối: lặp tăng dần nếu candidate đã tồn tại trong DB
  while (await tx.teacher.findUnique({ where: { teacherCode: candidate } })) {
    nextNum++;
    candidate = `${prefix}${String(nextNum).padStart(2, "0")}`;
  }

  return candidate;
}
