import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { Env } from "../index.js";
import {
  createRedis,
  getCachedTransform,
  setCachedTransform,
  hashString,
} from "../lib/cache.js";

const transform = new Hono<{ Bindings: Env }>();

transform.post("/", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  const startTime = Date.now();
  const urlHash = await hashString(body.url);
  const prefHash = await hashString(JSON.stringify(body.preferences));

  // ── Check Redis cache ──

  if (c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = createRedis(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN
      );
      const cached = await getCachedTransform(redis, urlHash, prefHash);
      if (cached) {
        return c.json({
          success: true,
          data: {
            instructions: cached,
            cached: true,
            processingMs: Date.now() - startTime,
          },
        });
      }
    } catch {
      // Redis unavailable, continue without cache
    }
  }

  // ── Forward to AI service ──

  const aiServiceUrl = c.env.AI_SERVICE_URL || "http://localhost:3001";

  try {
    const aiResponse = await fetch(`${aiServiceUrl}/ai/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: body.url,
        content: body.content.slice(0, 50000),
        preferences: body.preferences,
        regions: body.regions?.slice(0, 30),
      }),
    });

    if (!aiResponse.ok) {
      return c.json(
        {
          success: false,
          error: {
            code: "AI_SERVICE_ERROR",
            message: `AI service returned ${aiResponse.status}`,
          },
        },
        502
      );
    }

    const result = (await aiResponse.json()) as {
      instructions: unknown[];
      processingMs: number;
    };

    // ── Cache the result ──

    if (
      c.env.UPSTASH_REDIS_REST_URL &&
      c.env.UPSTASH_REDIS_REST_TOKEN &&
      result.instructions.length > 0
    ) {
      try {
        const redis = createRedis(
          c.env.UPSTASH_REDIS_REST_URL,
          c.env.UPSTASH_REDIS_REST_TOKEN
        );
        await setCachedTransform(redis, urlHash, prefHash, result.instructions);
      } catch {
        // Cache write failed, non-critical
      }
    }

    return c.json({
      success: true,
      data: {
        instructions: result.instructions,
        cached: false,
        processingMs: Date.now() - startTime,
      },
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

// ── Streaming endpoint for real-time transforms ──

transform.post("/stream", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  const aiServiceUrl = c.env.AI_SERVICE_URL || "http://localhost:3001";

  try {
    const aiResponse = await fetch(`${aiServiceUrl}/ai/transform/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: body.url,
        content: body.content.slice(0, 50000),
        preferences: body.preferences,
        regions: body.regions?.slice(0, 30),
      }),
    });

    if (!aiResponse.ok || !aiResponse.body) {
      return c.json(
        { success: false, error: { code: "AI_STREAM_ERROR", message: "Stream failed" } },
        502
      );
    }

    // Pass through the SSE stream from AI service
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    return stream(c, async (s) => {
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await s.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
    });
  } catch {
    return c.json(
      { success: false, error: { code: "AI_SERVICE_UNAVAILABLE", message: "Stream unavailable" } },
      503
    );
  }
});

export default transform;
