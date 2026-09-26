import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

/**
 * Checks if Cloudinary is configured with actual API credentials
 * (not default placeholder strings).
 */
export function isCloudinaryConfigured() {
  const url = process.env.CLOUDINARY_URL;
  if (!url || typeof url !== "string") return false;
  if (url.includes("<your_api_key>") || url.includes("<your_api_secret>")) {
    return false;
  }
  return true;
}

if (isCloudinaryConfigured()) {
  try {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
      secure: true,
    });
    console.log("[STORAGE] Cloudinary configured successfully.");
  } catch (err) {
    console.warn("[STORAGE] Failed to configure Cloudinary:", err.message);
  }
} else {
  console.log("[STORAGE] Cloudinary credentials not configured yet (using local storage fallback).");
}

export default cloudinary;
