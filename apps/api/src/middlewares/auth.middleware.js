import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { AppError } from "./error.middleware.js";

/**
 * Middleware xac thuc Bearer token.
 * Kiem tra tinh hop le cua JWT va xac minh trang thai nguoi dung truc tiep tu DB,
 * dam bao tai khoan bi KHOA (LOCKED) se bi tu choi ngay lap tuc ke ca voi token cu.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError("Ban chua xac thuc. Vui long dang nhap.", 401, "UNAUTHORIZED")
    );
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
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

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!user) {
      return next(new AppError("Nguoi dung khong ton tai.", 401, "USER_NOT_FOUND"));
    }

    if (user.status !== "ACTIVE") {
      return next(
        new AppError(
          "Tai khoan cua ban da bi khoa hoac chua kich hoat.",
          403,
          "ACCOUNT_INACTIVE"
        )
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.teacher?.fullName || null,
      teacher: user.teacher,
    };

    next();
  } catch (dbErr) {
    next(dbErr);
  }
}
