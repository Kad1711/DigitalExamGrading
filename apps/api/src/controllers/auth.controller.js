import { loginSchema, refreshSchema, logoutSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";
import { AppError } from "../middlewares/error.middleware.js";

function zodMsg(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((e) => e.message).join(" | ");
}

export async function loginController(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const { email, password } = parsed.data;
    const result = await authService.login(email, password);
    return res.status(200).json({
      success: true,
      message: "Dang nhap thanh cong.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function meController(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: req.user });
  } catch (err) {
    next(err);
  }
}

export async function refreshController(req, res, next) {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const { refreshToken } = parsed.data;
    const result = await authService.refreshAccessToken(refreshToken);
    return res.status(200).json({
      success: true,
      message: "Cap lai access token thanh cong.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutController(req, res, next) {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const { refreshToken } = parsed.data;
    await authService.logout(refreshToken);
    return res.status(200).json({ success: true, message: "Dang xuat thanh cong." });
  } catch (err) {
    next(err);
  }
}