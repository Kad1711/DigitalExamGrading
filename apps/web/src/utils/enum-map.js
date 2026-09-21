/**
 * Centralized Vietnamese display mappings for domain enums.
 *
 * NOTE: Backend enum values and API contracts remain unchanged.
 * This helper ensures consistent, professional terminology across teacher-facing UI.
 */

export const EXAM_STATUS_LABELS = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã phát hành",
  CLOSED: "Đã đóng",
  ARCHIVED: "Đã lưu trữ",
};

export const SCORING_TYPE_LABELS = {
  EQUAL: "Chia đều điểm",
  CUSTOM: "Điểm tùy chỉnh",
};

export const GRADING_STATUS_LABELS = {
  FINAL: "Chính thức",
  PROVISIONAL: "Tạm tính",
  NEEDS_REVIEW: "Cần kiểm tra",
};

export const OMR_STATUS_LABELS = {
  MARKED: "Đã tô",
  BLANK: "Để trống",
  MULTIPLE: "Tô nhiều ô",
  UNCERTAIN: "Cần kiểm tra",
  MULTIPLE_INVALID: "Tô nhiều ô / Không hợp lệ",
};

export const USER_ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
  PRINCIPAL: "Hiệu trưởng",
  VICE_PRINCIPAL: "Hiệu phó",
  EXAM_BOARD: "Ban khảo thí",
  ACADEMIC_BOARD: "Ban giáo dục và đào tạo",
};

export const USER_STATUS_LABELS = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Không hoạt động",
  PENDING_APPROVAL: "Chờ phê duyệt",
};

export const EXAM_TYPE_LABELS = {
  REGULAR: "Kiểm tra thường xuyên",
  MIN_15: "Kiểm tra 15 phút",
  MIN_45: "Kiểm tra 45 phút",
  MIN_60: "Kiểm tra 60 phút",
  MIN_90: "Kiểm tra 90 phút",
  MIDTERM: "Kiểm tra giữa kỳ",
  FINAL: "Kiểm tra cuối kỳ",
  OTHER: "Kỳ thi khác",
};

export const PUBLICATION_APPROVAL_STATUS_LABELS = {
  NOT_REQUESTED: "Không yêu cầu duyệt",
  PENDING_APPROVAL: "Đang chờ phê duyệt",
  APPROVED: "Đã phê duyệt",
  REJECTED: "Đã từ chối",
};

/**
 * Format ExamStatus enum to Vietnamese string
 * @param {string} status - DRAFT | PUBLISHED | CLOSED | ARCHIVED
 * @returns {string} Localized label
 */
export function formatExamStatus(status) {
  return EXAM_STATUS_LABELS[status] || status || "—";
}

/**
 * Format ScoringType enum to Vietnamese string
 * @param {string} scoringType - EQUAL | CUSTOM
 * @returns {string} Localized label
 */
export function formatScoringType(scoringType) {
  return SCORING_TYPE_LABELS[scoringType] || scoringType || "—";
}

/**
 * Format GradingStatus enum to Vietnamese string
 * @param {string} status - FINAL | PROVISIONAL | NEEDS_REVIEW
 * @returns {string} Localized label
 */
export function formatGradingStatus(status) {
  return GRADING_STATUS_LABELS[status] || status || "—";
}

/**
 * Format OMR status for single question
 * @param {string} status - MARKED | BLANK | MULTIPLE | UNCERTAIN
 * @returns {string} Localized label
 */
export function formatOmrStatus(status) {
  return OMR_STATUS_LABELS[status] || status || "—";
}

/**
 * Format UserRole enum to Vietnamese string
 * @param {string} role - ADMIN | TEACHER | STUDENT | PRINCIPAL | VICE_PRINCIPAL | EXAM_BOARD | ACADEMIC_BOARD
 * @returns {string} Localized label
 */
export function formatUserRole(role) {
  return USER_ROLE_LABELS[role] || role || "—";
}

/**
 * Format UserStatus enum to Vietnamese string
 * @param {string} status - ACTIVE | LOCKED | INACTIVE | PENDING_APPROVAL
 * @returns {string} Localized label
 */
export function formatUserStatus(status) {
  return USER_STATUS_LABELS[status] || status || "—";
}

/**
 * Format ExamType enum to Vietnamese string
 * @param {string} type - REGULAR | MIN_15 | MIN_45 | MIN_60 | MIN_90 | MIDTERM | FINAL | OTHER
 * @returns {string} Localized label
 */
export function formatExamType(type) {
  return EXAM_TYPE_LABELS[type] || type || "—";
}

/**
 * Format PublicationApprovalStatus enum to Vietnamese string
 * @param {string} status
 * @returns {string} Localized label
 */
export function formatPublicationApprovalStatus(status) {
  return PUBLICATION_APPROVAL_STATUS_LABELS[status] || status || "—";
}

/**
 * Get Initials Avatar text from Full Name or Email
 * e.g., "Nguyễn Văn An" -> "NA", "teacher@digitalexam.local" -> "TE"
 * @param {string} fullName
 * @param {string} email
 * @returns {string} 2-character initials
 */
export function getInitials(fullName, email) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email && email.trim()) {
    const namePart = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    return (namePart.slice(0, 2) || "U").toUpperCase();
  }
  return "U";
}

/**
 * Resolves avatar URL relative to API base URL or static path.
 * @param {string} avatarUrl
 * @returns {string|null}
 */
export function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return null;
  if (
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("data:") ||
    avatarUrl.startsWith("blob:")
  ) {
    return avatarUrl;
  }
  const base = import.meta.env.VITE_API_URL || "";
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  let cleanUrl = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;

  // If cleanUrl is legacy "/profile/avatar/...", prefix with "/api" so it routes through API proxy
  if (cleanUrl.startsWith("/profile/avatar/")) {
    cleanUrl = `/api${cleanUrl}`;
  }

  // Prevent double /api if base already contains /api
  if (cleanBase.endsWith("/api") && cleanUrl.startsWith("/api/")) {
    return `${cleanBase}${cleanUrl.slice(4)}`;
  }

  return `${cleanBase}${cleanUrl}`;
}
