import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";

// Recreate handleApiError to test it in isolation (it's not exported from index.ts)
// This mirrors the exact logic from server/src/index.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleApiError(err: unknown, c: any, code: string) {
  if (err instanceof Anthropic.RateLimitError) {
    return c.json({ success: false, error: { code: "RATE_LIMITED", message: "AI service is temporarily busy. Please try again in a moment." } }, 429);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return c.json({ success: false, error: { code: "AI_AUTH_FAILED", message: "AI service configuration error" } }, 500);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return c.json({ success: false, error: { code: "AI_UNAVAILABLE", message: "AI service is temporarily unavailable" } }, 503);
  }
  return c.json({ success: false, error: { code, message: "An unexpected error occurred" } }, 500);
}

function createErrorTestApp() {
  const app = new Hono();

  app.post("/test-error", async (c) => {
    const body = await c.req.json<{ errorType: string }>();

    let err: Error;
    switch (body.errorType) {
      case "rate_limit":
        err = new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "Rate limited" } }, "rate limited", {});
        break;
      case "auth":
        err = new Anthropic.AuthenticationError(401, { type: "error", error: { type: "authentication_error", message: "Invalid key" } }, "unauthorized", {});
        break;
      case "connection":
        err = new Anthropic.APIConnectionError({ cause: new Error("connection failed") });
        break;
      default:
        err = new Error("Something went wrong");
    }

    return handleApiError(err, c, "TEST_FAILED");
  });

  return app;
}

describe("handleApiError", () => {
  const app = createErrorTestApp();

  it("returns 429 for RateLimitError", async () => {
    const res = await app.request("/test-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorType: "rate_limit" }),
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.success).toBe(false);
  });

  it("returns 500 for AuthenticationError", async () => {
    const res = await app.request("/test-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorType: "auth" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("AI_AUTH_FAILED");
  });

  it("returns 503 for APIConnectionError", async () => {
    const res = await app.request("/test-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorType: "connection" }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("AI_UNAVAILABLE");
  });

  it("returns 500 with provided code for unknown errors", async () => {
    const res = await app.request("/test-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorType: "unknown" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("TEST_FAILED");
    expect(body.error.message).toBe("An unexpected error occurred");
  });
});

describe("CORS origin logic", () => {
  // Recreate the CORS origin function from index.ts
  const ALLOWED_LOCALHOST = new Set([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8787",
  ]);

  function corsOrigin(origin: string | undefined): string | null {
    if (!origin) return null;
    if (origin.startsWith("chrome-extension://")) return origin;
    if (origin.startsWith("moz-extension://")) return origin;
    if (ALLOWED_LOCALHOST.has(origin)) return origin;
    return null;
  }

  it("rejects requests with no origin", () => {
    expect(corsOrigin(undefined)).toBeNull();
  });

  it("allows chrome extension origins", () => {
    const origin = "chrome-extension://abcdefghijklmnop";
    expect(corsOrigin(origin)).toBe(origin);
  });

  it("allows firefox extension origins", () => {
    const origin = "moz-extension://abc-def-ghi";
    expect(corsOrigin(origin)).toBe(origin);
  });

  it("allows whitelisted localhost origins", () => {
    expect(corsOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(corsOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    expect(corsOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    expect(corsOrigin("http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("rejects non-whitelisted localhost ports", () => {
    expect(corsOrigin("http://localhost:9999")).toBeNull();
  });

  it("rejects attacker domains that contain 'localhost'", () => {
    expect(corsOrigin("http://evil-localhost.com")).toBeNull();
    expect(corsOrigin("http://localhost.evil.com")).toBeNull();
  });

  it("rejects arbitrary external origins", () => {
    expect(corsOrigin("https://evil.com")).toBeNull();
    expect(corsOrigin("https://example.com")).toBeNull();
  });
});
