/**
 * Helper to generate or format email for student: className_sbd@digitalexam.edu.vn
 */
export function makeStudentEmail(className, studentCode, customEmail) {
  if (customEmail && customEmail.trim()) {
    return customEmail.trim().toLowerCase();
  }
  const cleanClass = (className || "lop").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const rawCode = (studentCode || "0").trim();
  const paddedCode = /^\d+$/.test(rawCode) && rawCode.length === 1 ? `0${rawCode}` : rawCode;
  const cleanCode = paddedCode.replace(/[^a-zA-Z0-9]/g, "");
  return `${cleanClass}_${cleanCode}@digitalexam.edu.vn`.toLowerCase();
}

/**
 * Format KKLLSS (6 digits):
 * KK: 2-digit grade level (e.g. 06, 09, 12)
 * LL: 2-digit class number in grade (e.g. 9C06 -> 06, 12A01 -> 01, 10A2 -> 02, 6A -> 01)
 * SS: 2-digit student index in class (e.g. 01, 02, ..., 45)
 */
export function generateSmartSbd(className = "", gradeLevel = null, studentIndex = 1) {
  // 1. Khối học (2 số): KK
  let kk = "00";
  if (gradeLevel && !isNaN(parseInt(gradeLevel, 10))) {
    kk = String(parseInt(gradeLevel, 10)).padStart(2, "0");
  } else {
    const mGrade = (className || "").match(/^(\d{1,2})/);
    if (mGrade) {
      kk = String(parseInt(mGrade[1], 10)).padStart(2, "0");
    }
  }

  // 2. Mã lớp (2 số): LL
  let ll = "01";
  const mClassNum = (className || "").match(/^(\d{1,2})[A-Za-z_-]*(\d+)/);
  if (mClassNum && mClassNum[2]) {
    ll = String(parseInt(mClassNum[2], 10)).padStart(2, "0");
  } else {
    const mLetter = (className || "").match(/^(\d{1,2})([A-Za-z])/);
    if (mLetter && mLetter[2]) {
      const code = mLetter[2].toUpperCase().charCodeAt(0) - 64;
      if (code >= 1 && code <= 99) {
        ll = String(code).padStart(2, "0");
      }
    }
  }

  // 3. Số thứ tự trong lớp (2 số): SS
  const ss = String(Math.max(1, parseInt(studentIndex, 10) || 1)).padStart(2, "0");

  return `${kk}${ll}${ss}`;
}
