import cors from "cors";

/**
 * Configure CORS options based on environment and CORS_ORIGIN.
 *
 * Rules:
 * - Comma-separated allowed origins in CORS_ORIGIN are trimmed and parsed.
 * - If CORS_ORIGIN is '*', wildcard is permitted.
 * - If NODE_ENV === 'production' and CORS_ORIGIN is missing/empty:
 *   fail safe by disallowing cross-origin requests (origin: false).
 * - In non-production environments without CORS_ORIGIN:
 *   convenient development default allows '*'
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Allowed Headers: Content-Type, Authorization
 */
export function getCorsOptions(nodeEnv = process.env.NODE_ENV, corsOrigin = process.env.CORS_ORIGIN) {
  const isProd = nodeEnv === "production";
  const trimmed = typeof corsOrigin === "string" ? corsOrigin.trim() : "";

  let origin;
  if (trimmed) {
    const parsed = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      origin = isProd ? false : "*";
    } else if (parsed.length === 1 && parsed[0] === "*") {
      origin = "*";
    } else {
      origin = parsed;
    }
  } else if (isProd) {
    origin = false;
  } else {
    origin = "*";
  }

  return {
    origin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

export function createCorsMiddleware(nodeEnv = process.env.NODE_ENV, corsOrigin = process.env.CORS_ORIGIN) {
  return cors(getCorsOptions(nodeEnv, corsOrigin));
}
