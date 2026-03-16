import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// We test the validation and auth middleware logic by recreating the app setup
// from index.ts. This avoids starting the actual server.

function createTestApp(apiKey?: string) {
  const app = new Hono();

  // Auth middleware
  app.use("/api/*", async (c, next) => {
    if (!apiKey) return next();
    const authHeader = c.req.header("Authorization");
    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      return c.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        401
      );
    }
    return next();
  });

  const MAX_CONTENT_LENGTH = 50_000;
  const MAX_REGIONS = 30;
  const MAX_TEXT_LENGTH = 5_000;
  const VALID_READING_LEVELS = new Set(["elementary", "middle-school", "high-school", "college", "original"]);
  const VALID_INCOME_BRACKETS = new Set(["0-10k", "10k-20k", "20k-30k", "30k-40k", "40k-50k", "50k-75k", "75k-100k", "100k+"]);
  const VALID_AGE_BRACKETS = new Set(["under-18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);

  function validationError(c: Parameters<Parameters<typeof app.post>[1]>[0], message: string) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message } }, 400);
  }

  // Transform endpoint (validation only, no AI)
  app.post("/api/transform", async (c) => {
    const body = await c.req.json<{
      content: string;
      regions?: unknown[];
    }>();

    if (!body.content || typeof body.content !== "string") {
      return validationError(c, "content is required and must be a string");
    }
    if (body.content.length > MAX_CONTENT_LENGTH) {
      return validationError(c, `content exceeds maximum length of ${MAX_CONTENT_LENGTH}`);
    }
    if (body.regions && (body.regions as unknown[]).length > MAX_REGIONS) {
      return validationError(c, `regions exceeds maximum of ${MAX_REGIONS}`);
    }

    return c.json({ success: true, data: { instructions: [], cached: false, processingMs: 0 } });
  });

  // Explain endpoint (validation only)
  app.post("/api/explain", async (c) => {
    const body = await c.req.json<{
      text: string;
      readingLevel?: string;
    }>();

    if (!body.text || typeof body.text !== "string") {
      return validationError(c, "text is required and must be a string");
    }
    if (body.text.length > MAX_TEXT_LENGTH) {
      return validationError(c, `text exceeds maximum length of ${MAX_TEXT_LENGTH}`);
    }
    if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
      return validationError(c, "invalid readingLevel");
    }

    return c.json({ success: true, data: { answer: "test" } });
  });

  // Benefits endpoint (validation only)
  app.post("/api/benefits/evaluate", async (c) => {
    const body = await c.req.json<{
      profile: {
        incomeBracket?: string | null;
        ageBracket?: string | null;
        householdSize?: number | null;
        state?: string | null;
      };
      readingLevel?: string;
    }>();

    if (!body.profile || typeof body.profile !== "object") {
      return validationError(c, "profile is required");
    }
    if (body.profile.incomeBracket && !VALID_INCOME_BRACKETS.has(body.profile.incomeBracket)) {
      return validationError(c, "invalid incomeBracket");
    }
    if (body.profile.ageBracket && !VALID_AGE_BRACKETS.has(body.profile.ageBracket)) {
      return validationError(c, "invalid ageBracket");
    }
    if (body.profile.householdSize != null && (body.profile.householdSize < 1 || body.profile.householdSize > 20)) {
      return validationError(c, "householdSize must be between 1 and 20");
    }
    if (body.profile.state && (typeof body.profile.state !== "string" || body.profile.state.length !== 2)) {
      return validationError(c, "state must be a 2-letter code");
    }
    if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
      return validationError(c, "invalid readingLevel");
    }

    return c.json({ success: true, data: { recommendations: [] } });
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}

describe("API authentication", () => {
  it("allows requests when no API key is configured", async () => {
    const app = createTestApp();
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", context: "" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects requests without auth header when API key is set", async () => {
    const app = createTestApp("test-key");
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", context: "" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with wrong API key", async () => {
    const app = createTestApp("correct-key");
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-key",
      },
      body: JSON.stringify({ text: "hello", context: "" }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts requests with correct API key", async () => {
    const app = createTestApp("my-key");
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer my-key",
      },
      body: JSON.stringify({ text: "hello", context: "" }),
    });
    expect(res.status).toBe(200);
  });

  it("does not require auth for health endpoint", async () => {
    const app = createTestApp("my-key");
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});

describe("transform validation", () => {
  const app = createTestApp();

  it("rejects missing content", async () => {
    const res = await app.request("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-string content", async () => {
    const res = await app.request("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: 123 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects content exceeding max length", async () => {
    const res = await app.request("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(50_001) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("50000");
  });

  it("rejects too many regions", async () => {
    const regions = Array.from({ length: 31 }, (_, i) => ({
      selector: `#el-${i}`,
      type: "paragraph",
      content: "test",
    }));
    const res = await app.request("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test", regions }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts valid transform request", async () => {
    const res = await app.request("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Some page content" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("explain validation", () => {
  const app = createTestApp();

  it("rejects missing text", async () => {
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects text exceeding max length", async () => {
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(5001) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid reading level", async () => {
    const res = await app.request("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", readingLevel: "kindergarten" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("readingLevel");
  });

  it("accepts valid reading levels", async () => {
    for (const level of ["elementary", "middle-school", "high-school", "college", "original"]) {
      const res = await app.request("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello", readingLevel: level }),
      });
      expect(res.status).toBe(200);
    }
  });
});

describe("benefits/evaluate validation", () => {
  const app = createTestApp();

  it("rejects missing profile", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid income bracket", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { incomeBracket: "million" } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("incomeBracket");
  });

  it("rejects invalid age bracket", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { ageBracket: "young" } }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects household size out of range", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { householdSize: 0 } }),
    });
    expect(res.status).toBe(400);

    const res2 = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { householdSize: 21 } }),
    });
    expect(res2.status).toBe(400);
  });

  it("rejects invalid state code", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { state: "California" } }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts valid profile", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          incomeBracket: "20k-30k",
          state: "CA",
          householdSize: 3,
          ageBracket: "25-34",
        },
      }),
    });
    expect(res.status).toBe(200);
  });

  it("accepts null fields in profile", async () => {
    const res = await app.request("/api/benefits/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          incomeBracket: null,
          state: null,
          householdSize: null,
        },
      }),
    });
    expect(res.status).toBe(200);
  });
});
