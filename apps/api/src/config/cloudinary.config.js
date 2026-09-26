import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

/**
 * Normalizes and extracts clean Cloudinary URL by removing any accidental < > brackets.
 */
export function getCleanCloudinaryUrl() {
  const url = process.env.CLOUDINARY_URL;
  if (!url || typeof url !== "string") return null;
  const clean = url.replace(/<([^>]+)>/g, "$1").trim();
  if (clean.includes("your_api_key") || clean.includes("your_api_secret")) {
    return null;
  }
  return clean;
}

/**
 * Checks if Cloudinary is configured with actual API credentials.
 */
export function isCloudinaryConfigured() {
  return !!getCleanCloudinaryUrl();
}

const cleanUrl = getCleanCloudinaryUrl();
if (cleanUrl) {
  try {
    cloudinary.config({
      cloudinary_url: cleanUrl,
      secure: true,
    });
    console.log("[STORAGE] Cloudinary configured and verified.");
  } catch (err) {
    console.warn("[STORAGE] Failed to configure Cloudinary:", err.message);
  }
} else {
  console.log("[STORAGE] Cloudinary credentials not configured yet (using local storage fallback).");
}

export default cloudinary;
