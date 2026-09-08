import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCorsOptions } from "../src/config/cors.config.js";

describe("CORS Configuration", () => {
  it("defaults to wildcard in development without CORS_ORIGIN", () => {
    const options = getCorsOptions("development", undefined);
    assert.equal(options.origin, "*");
    assert.deepEqual(options.methods, ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
    assert.deepEqual(options.allowedHeaders, ["Content-Type", "Authorization"]);
  });

  it("fails safe by disabling cross-origin requests in production when CORS_ORIGIN is missing", () => {
    const options = getCorsOptions("production", undefined);
    assert.equal(options.origin, false);
  });

  it("fails safe in production when CORS_ORIGIN is empty string", () => {
    const options = getCorsOptions("production", "   ");
    assert.equal(options.origin, false);
  });

  it("parses single allowed origin with whitespace trimmed", () => {
    const options = getCorsOptions("production", "  https://client.onrender.com  ");
    assert.deepEqual(options.origin, ["https://client.onrender.com"]);
  });

  it("parses multiple comma-separated allowed origins with whitespace trimmed", () => {
    const options = getCorsOptions(
      "production",
      "https://client.onrender.com, http://localhost:5173 , https://admin.digitalexam.local"
    );
    assert.deepEqual(options.origin, [
      "https://client.onrender.com",
      "http://localhost:5173",
      "https://admin.digitalexam.local",
    ]);
  });

  it("permits explicit wildcard when configured", () => {
    const options = getCorsOptions("production", "*");
    assert.equal(options.origin, "*");
  });
});
