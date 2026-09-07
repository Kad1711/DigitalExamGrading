import jwt from "jsonwebtoken";
import { AppError } from "./error.middleware.js";

/**
 * Middleware xac thuc Bearer token.
 * Gan req.user = { id, email, role, status } neu hop le.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError("Ban chua xac thuc. Vui long dang nhap.", 401, "UNAUTHORIZED")
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(
        new AppError(
          "Phien dang nhap da het han. Vui long dang nhap lai.",
          401,
          "TOKEN_EXPIRED"
        )
      );
    }
    return next(new AppError("Token khong hop le.", 401, "INVALID_TOKEN"));
  }
}
