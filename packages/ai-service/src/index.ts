import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamText } from "./ai/transform.js";
import { explainText } from "./ai/explain.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// ── Content Transformation (streaming) ──

app.post("/ai/transform", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  const startTime = Date.now();

  const instructions = await streamText(
    body.content,
    body.preferences,
    body.regions
  );

  return c.json({
    instructions,
    cached: false,
    processingMs: Date.now() - startTime,
  });
});

// ── Text Explanation ──

app.post("/ai/explain", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
    readingLevel?: string;
  }>();

  const answer = await explainText(
    body.text,
    body.context,
    body.readingLevel
  );

  return c.json({ answer });
});

// ── Health ──

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ivy-ai-service",
    timestamp: new Date().toISOString(),
  });
});

const port = parseInt(process.env.PORT ?? "3001", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Ivy AI service running on http://localhost:${port}`);
});
