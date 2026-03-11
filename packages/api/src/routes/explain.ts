import { Hono } from "hono";
import type { Env } from "../index.js";
import {
  createRedis,
  getCachedExplanation,
  setCachedExplanation,
  hashString,
} from "../lib/cache.js";

const explain = new Hono<{ Bindings: Env }>();

explain.post("/", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
    readingLevel?: string;
  }>();

  const startTime = Date.now();

  // ── Check cache ──

  const cacheKey = await hashString(`${body.text}:${body.readingLevel ?? "middle-school"}`);

  if (c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = createRedis(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN
      );
      const cached = await getCachedExplanation(redis, cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: { answer: cached, cached: true, processingMs: Date.now() - startTime },
        });
      }
    } catch {
      // Continue without cache
    }
  }

  // ── Forward to AI service ──

  const aiServiceUrl = c.env.AI_SERVICE_URL || "http://localhost:3001";

  try {
    const aiResponse = await fetch(`${aiServiceUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.text.slice(0, 2000),
        context: body.context.slice(0, 500),
        readingLevel: body.readingLevel,
      }),
    });

    if (!aiResponse.ok) {
      return c.json(
        {
          success: false,
          error: { code: "AI_SERVICE_ERROR", message: `AI service returned ${aiResponse.status}` },
        },
        502
      );
    }

    const result = (await aiResponse.json()) as { answer: string };

    // ── Cache the result ──

    if (c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = createRedis(
          c.env.UPSTASH_REDIS_REST_URL,
          c.env.UPSTASH_REDIS_REST_TOKEN
        );
        await setCachedExplanation(redis, cacheKey, result.answer);
      } catch {
        // Non-critical
      }
    }

    return c.json({
      success: true,
      data: { answer: result.answer, cached: false, processingMs: Date.now() - startTime },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Could not reach AI service. Is it running on localhost:3001?",
        },
      },
      503
    );
  }
});

export default explain;
