import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import transformRoutes from "./routes/transform.js";
import explainRoutes from "./routes/explain.js";
import preferencesRoutes from "./routes/preferences.js";
import eventsRoutes from "./routes/events.js";

export interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY?: string;
  AI_SERVICE_URL: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// ── Middleware ──

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "chrome-extension://*",
      "http://localhost:*",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Routes ──

app.route("/api/transform", transformRoutes);
app.route("/api/explain", explainRoutes);
app.route("/api/preferences", preferencesRoutes);
app.route("/api/events", eventsRoutes);

// ── Health Check ──

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ivy-api",
    hasRedis: !!(c.env.UPSTASH_REDIS_REST_URL && c.env.UPSTASH_REDIS_REST_TOKEN),
    hasDb: !!c.env.DATABASE_URL,
    hasAiService: !!c.env.AI_SERVICE_URL,
    timestamp: new Date().toISOString(),
  });
});

export default app;
