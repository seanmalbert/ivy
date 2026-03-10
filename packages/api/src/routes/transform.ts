import { Hono } from "hono";
import type { Env } from "../index.js";

const transform = new Hono<{ Bindings: Env }>();

transform.post("/", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
  }>();

  // TODO: Phase 2 — forward to AI orchestration service for full transform
  // For now, return basic CSS-only accessibility instructions
  const instructions = [];

  const prefs = body.preferences;

  if (prefs.fontScale && prefs.fontScale !== 1.0) {
    instructions.push({
      selector: "html",
      action: "style",
      value: `font-size: ${(prefs.fontScale as number) * 100}% !important`,
    });
  }

  if (prefs.highContrast) {
    instructions.push({
      selector: "body",
      action: "style",
      value: "color: #000 !important; background: #fff !important",
    });
  }

  return c.json({
    success: true,
    data: {
      instructions,
      cached: false,
      processingMs: 0,
    },
  });
});

export default transform;
