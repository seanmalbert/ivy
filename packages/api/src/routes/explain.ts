import { Hono } from "hono";
import type { Env } from "../index.js";

const explain = new Hono<{ Bindings: Env }>();

explain.post("/", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
  }>();

  // TODO: Phase 2 — forward to AI service for Claude-powered explanation
  // For now, return a placeholder
  return c.json({
    success: true,
    data: {
      answer: `Here's a simpler explanation of "${body.text.slice(0, 50)}...": This feature will be powered by Claude AI in Phase 2. For now, try highlighting shorter text for best results.`,
    },
  });
});

export default explain;
