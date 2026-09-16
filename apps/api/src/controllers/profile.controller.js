import {
  updateProfileSchema,
  changePasswordSchema,
} from "../schemas/profile.schema.js";
import * as profileService from "../services/profile.service.js";
import { AppError } from "../middlewares/error.middleware.js";

function zodMsg(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((e) => e.message).join(" | ");
}

export async function getProfileController(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.id);
    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileController(req, res, next) {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const updated = await profileService.updateProfile(req.user.id, parsed.data);
    return res.status(200).json({
      success: true,
      message: "Cap nhat ho so thanh cong.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordController(req, res, next) {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const result = await profileService.changePassword(req.user.id, parsed.data);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarController(req, res, next) {
  try {
    if (!req.file) {
      return next(new AppError("Vui lòng tải lên một file ảnh đại diện.", 400, "AVATAR_REQUIRED"));
    }

    const result = await profileService.updateAvatar(req.user.id, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật ảnh đại diện thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAvatarController(req, res, next) {
  try {
    const { stream, mimeType } = await profileService.getAvatarStream(req.params.filename);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

