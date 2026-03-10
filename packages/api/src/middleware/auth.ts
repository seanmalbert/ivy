import { createMiddleware } from "hono/factory";
import type { Env } from "../index.js";

/**
 * Auth middleware placeholder.
 * Phase 1: Passes through (no auth required for local dev).
 * Will integrate Clerk JWT verification.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    // TODO: Integrate Clerk JWT verification
    // const token = c.req.header("Authorization")?.replace("Bearer ", "");
    // if (!token) return c.json({ error: "Unauthorized" }, 401);
    // const session = await clerkClient.verifyToken(token);
    // c.set("userId", session.sub);

    await next();
  }
);
