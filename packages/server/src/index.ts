import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { transformContent } from "./ai/transform.js";
import { explainText } from "./ai/explain.js";
import { rankAndExplainBenefits } from "./ai/benefits.js";
import { evaluateEligibility, FEDERAL_RULES } from "@ivy/benefits-engine";

const app = new Hono();

app.use("*", logger());
// Allowed origins for CORS
const ALLOWED_LOCALHOST = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:8787",
]);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null; // Reject requests with no origin
      if (origin.startsWith("chrome-extension://")) return origin;
      if (origin.startsWith("moz-extension://")) return origin;
      if (ALLOWED_LOCALHOST.has(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ── API Key Auth (protects AI endpoints from unauthorized use) ──

const API_KEY = process.env.IVY_API_KEY;

app.use("/api/*", async (c, next) => {
  // If no IVY_API_KEY is configured, skip auth (dev mode)
  if (!API_KEY) return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
      401
    );
  }
  return next();
});

// ── Transform ──

app.post("/api/transform", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  const startTime = Date.now();

  try {
    const instructions = await transformContent(
      body.content,
      body.preferences,
      body.regions
    );

    return c.json({
      success: true,
      data: {
        instructions,
        cached: false,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error("Transform error:", err);
    return c.json(
      {
        success: false,
        error: { code: "TRANSFORM_FAILED", message: "Transform failed" },
      },
      500
    );
  }
});

// ── Explain ──

app.post("/api/explain", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
    readingLevel?: string;
  }>();

  const startTime = Date.now();

  try {
    const answer = await explainText(
      body.text,
      body.context,
      body.readingLevel
    );

    return c.json({
      success: true,
      data: {
        answer,
        cached: false,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error("Explain error:", err);
    return c.json(
      {
        success: false,
        error: { code: "EXPLAIN_FAILED", message: "Explanation failed" },
      },
      500
    );
  }
});

// ── Benefits Evaluation ──

app.post("/api/benefits/evaluate", async (c) => {
  const body = await c.req.json<{
    profile: {
      incomeBracket: string | null;
      state: string | null;
      householdSize: number | null;
      hasDisability: boolean | null;
      veteranStatus: boolean | null;
      ageBracket: string | null;
    };
    readingLevel?: string;
  }>();

  const startTime = Date.now();

  try {
    // Step 1: Deterministic rules engine
    const eligibilityResults = evaluateEligibility(body.profile, FEDERAL_RULES);

    // Step 2: AI ranking and plain-language explanations
    const recommendations = await rankAndExplainBenefits(
      eligibilityResults,
      body.profile,
      body.readingLevel
    );

    return c.json({
      success: true,
      data: {
        recommendations,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error("Benefits evaluation error:", err);
    return c.json(
      {
        success: false,
        error: { code: "BENEFITS_FAILED", message: "Benefits evaluation failed" },
      },
      500
    );
  }
});

// ── Events (fire-and-forget, no DB required) ──

app.post("/api/events", async (c) => {
  // Accept and acknowledge — no DB for now
  return c.json({ success: true, data: { id: crypto.randomUUID() } });
});

// ── Health ──

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ivy-server",
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ── Start ──

const port = parseInt(process.env.PORT ?? "3001", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Ivy server running on http://localhost:${port}`);
});
