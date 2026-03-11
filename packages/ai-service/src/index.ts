import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { stream } from "hono/streaming";
import { transformContent, streamTransformContent } from "./ai/transform.js";
import { explainText } from "./ai/explain.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// ── Content Transformation ──

app.post("/ai/transform", async (c) => {
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
      instructions,
      cached: false,
      processingMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error("Transform error:", err);
    return c.json(
      { error: "Transform failed", instructions: [], processingMs: Date.now() - startTime },
      500
    );
  }
});

// ── Streaming Transform ──

app.post("/ai/transform/stream", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  return stream(c, async (s) => {
    try {
      for await (const chunk of streamTransformContent(
        body.content,
        body.preferences,
        body.regions
      )) {
        await s.write(chunk);
      }
    } catch (err) {
      console.error("Stream error:", err);
      await s.write(
        "data: " + JSON.stringify({ type: "error", message: "Stream failed" }) + "\n\n"
      );
    }
  });
});

// ── Text Explanation ──

app.post("/ai/explain", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
    readingLevel?: string;
  }>();

  try {
    const answer = await explainText(
      body.text,
      body.context,
      body.readingLevel
    );

    return c.json({ answer });
  } catch (err) {
    console.error("Explain error:", err);
    return c.json(
      { answer: "Sorry, I couldn't explain that right now. Please try again." },
      500
    );
  }
});

// ── Health ──

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ivy-ai-service",
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

const port = parseInt(process.env.PORT ?? "3001", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Ivy AI service running on http://localhost:${port}`);
});
