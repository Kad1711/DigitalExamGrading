import { AppError } from "./error.middleware.js";

export const VALID_ROLES = new Set([
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "EXAM_OFFICER",
  "TEACHER",
  "STUDENT",
]);

/**
 * Middleware kiem tra quyen truy cap theo role.
 * Phai dung sau authenticate middleware.
 *
 * @param {...string} roles - Cac role duoc phep (chi 6 role THCS V2 hop le)
 * @returns {Function} Express middleware
 */
export function authorizeRoles(...roles) {
  for (const role of roles) {
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Invalid role configured in authorizeRoles: ${role}. Only canonical THCS V2 roles are allowed.`);
    }
  }

  const allowedRoles = new Set(roles);

  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Ban chua xac thuc.", 401, "UNAUTHORIZED"));
    }

    if (!allowedRoles.has(req.user.role)) {
      return next(
        new AppError(
          "Ban khong co quyen truy cap tai nguyen nay.",
          403,
          "FORBIDDEN"
        )
      );
    }

    next();
  };
}
