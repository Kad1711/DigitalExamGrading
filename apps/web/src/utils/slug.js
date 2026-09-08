/**
 * Utility functions for friendly Vietnamese URLs
 */

export function slugifyVietnamese(text) {
  if (!text || typeof text !== "string") return "ky-thi";

  let slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accent marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "") // remove special characters
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphen
    .replace(/-+/g, "-") // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens

  return slug || "ky-thi";
}

export function examDetailPath(exam) {
  if (!exam) return "/exams";
  if (typeof exam === "string") return `/exams/${exam}`;
  const slug = slugifyVietnamese(exam.title);
  return `/exams/${exam.id}/${slug}`;
}
