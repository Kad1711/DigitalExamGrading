import { AppError } from "./error.middleware.js";

/**
 * Middleware kiem tra quyen truy cap theo role.
 * Phai dung sau authenticate middleware.
 *
 * @param {...string} roles - Cac role duoc phep, vi du: "ADMIN", "TEACHER"
 * @returns {Function} Express middleware
 *
 * @example
 * router.get("/admin-only", authenticate, authorizeRoles("ADMIN"), handler)
 * router.get("/staff", authenticate, authorizeRoles("ADMIN", "TEACHER"), handler)
 */
export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Ban chua xac thuc.", 401, "UNAUTHORIZED"));
    }

    if (!roles.includes(req.user.role)) {
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
