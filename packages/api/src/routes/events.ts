import { Hono } from "hono";
import type { Env } from "../index.js";
import { createDb, schema } from "../db/index.js";

const events = new Hono<{ Bindings: Env }>();

events.post("/", async (c) => {
  const body = await c.req.json<{
    userId: string;
    eventType: string;
    context: Record<string, unknown>;
  }>();

  // Skip DB write if no DATABASE_URL configured
  if (!c.env.DATABASE_URL) {
    return c.json({ success: true, data: { id: "local-" + Date.now() } });
  }

  const db = createDb(c.env.DATABASE_URL);
  const id = crypto.randomUUID();

  await db.insert(schema.behavioralEvents).values({
    id,
    userId: body.userId,
    eventType: body.eventType,
    context: body.context,
  });

  return c.json({ success: true, data: { id } });
});

export default events;
