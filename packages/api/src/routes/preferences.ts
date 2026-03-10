import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../index.js";
import { createDb, schema } from "../db/index.js";

const preferences = new Hono<{ Bindings: Env }>();

preferences.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const db = createDb(c.env.DATABASE_URL);

  const prefs = await db.query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
  });

  if (!prefs) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Preferences not found" } }, 404);
  }

  return c.json({ success: true, data: prefs });
});

preferences.put("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json();
  const db = createDb(c.env.DATABASE_URL);

  const result = await db
    .insert(schema.userPreferences)
    .values({ userId, ...body })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: body,
    })
    .returning();

  return c.json({ success: true, data: result[0] });
});

export default preferences;
