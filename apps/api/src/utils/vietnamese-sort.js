/**
 * Vietnamese Name Comparator for sorting students by Given Name (Tên) then Family & Middle Names (Họ & chữ đệm).
 * Accepts strings or objects containing fullName / student.fullName.
 */
export function compareVietnameseNames(a, b) {
  const getStr = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "object") {
      if (val.student && typeof val.student.fullName === "string") return val.student.fullName.trim();
      if (typeof val.fullName === "string") return val.fullName.trim();
      if (typeof val.name === "string") return val.name.trim();
    }
    return String(val).trim();
  };

  const cleanA = getStr(a);
  const cleanB = getStr(b);
  if (!cleanA && !cleanB) return 0;
  if (!cleanA) return 1;
  if (!cleanB) return -1;

  const aParts = cleanA.split(/\s+/);
  const bParts = cleanB.split(/\s+/);

  const aFirstName = aParts[aParts.length - 1] || "";
  const bFirstName = bParts[bParts.length - 1] || "";

  const firstCompare = aFirstName.localeCompare(bFirstName, "vi", { sensitivity: "base" });
  if (firstCompare !== 0) return firstCompare;

  return cleanA.localeCompare(cleanB, "vi", { sensitivity: "base" });
}
