import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Anthropic from "@anthropic-ai/sdk";
import { transformContent } from "./ai/transform.js";
import { explainText } from "./ai/explain.js";
import { rankAndExplainBenefits } from "./ai/benefits.js";
import { generateFormGuidance } from "./ai/form-guidance.js";
import { categorizeFeedback } from "./ai/categorize.js";
import { addInteraction, getAggregatedInsights, getPageInsights } from "./feedback/store.js";
import { getCachedResponse, setCachedResponse, updateCachedResponse, getAllCachedResponses } from "./feedback/response-cache.js";
import type { InteractionType } from "./feedback/store.js";
import { evaluateEligibility, FEDERAL_RULES } from "@ivy/benefits-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleApiError(err: unknown, c: Context<any>, code: string) {
  if (err instanceof Anthropic.RateLimitError) {
    console.error(`${code}: Rate limited by Anthropic`);
    return c.json({ success: false, error: { code: "RATE_LIMITED", message: "AI service is temporarily busy. Please try again in a moment." } }, 429);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(`${code}: Anthropic authentication failed`);
    return c.json({ success: false, error: { code: "AI_AUTH_FAILED", message: "AI service configuration error" } }, 500);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    console.error(`${code}: Cannot connect to Anthropic:`, err.message);
    return c.json({ success: false, error: { code: "AI_UNAVAILABLE", message: "AI service is temporarily unavailable" } }, 503);
  }
  console.error(`${code}:`, err);
  return c.json({ success: false, error: { code, message: "An unexpected error occurred" } }, 500);
}

const app = new Hono();

app.use("*", logger());
// Allowed origins for CORS
const ALLOWED_LOCALHOST = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:8787",
]);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null; // Reject requests with no origin
      if (origin.startsWith("chrome-extension://")) return origin;
      if (origin.startsWith("moz-extension://")) return origin;
      if (ALLOWED_LOCALHOST.has(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ── API Key Auth (protects AI endpoints from unauthorized use) ──

const API_KEY = process.env.IVY_API_KEY;

app.use("/api/*", async (c, next) => {
  // If no IVY_API_KEY is configured, skip auth (dev mode)
  if (!API_KEY) return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
      401
    );
  }
  return next();
});

// ── Request Validation Helpers ──

const MAX_CONTENT_LENGTH = 50_000;
const MAX_REGIONS = 30;
const MAX_TEXT_LENGTH = 5_000;
const VALID_READING_LEVELS = new Set(["elementary", "middle-school", "high-school", "college", "original"]);
const VALID_INCOME_BRACKETS = new Set(["0-10k", "10k-20k", "20k-30k", "30k-40k", "40k-50k", "50k-75k", "75k-100k", "100k+"]);
const VALID_AGE_BRACKETS = new Set(["under-18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validationError(c: Context<any>, message: string) {
  return c.json({ success: false, error: { code: "VALIDATION_ERROR", message } }, 400);
}

// ── Transform ──

app.post("/api/transform", async (c) => {
  const body = await c.req.json<{
    url: string;
    content: string;
    preferences: Record<string, unknown>;
    regions?: Array<{ selector: string; type: string; content: string }>;
  }>();

  if (!body.content || typeof body.content !== "string") {
    return validationError(c, "content is required and must be a string");
  }
  if (body.content.length > MAX_CONTENT_LENGTH) {
    return validationError(c, `content exceeds maximum length of ${MAX_CONTENT_LENGTH}`);
  }
  if (body.regions && body.regions.length > MAX_REGIONS) {
    return validationError(c, `regions exceeds maximum of ${MAX_REGIONS}`);
  }

  const startTime = Date.now();

  try {
    const instructions = await transformContent(
      body.content,
      body.preferences ?? {},
      body.regions
    );

    return c.json({
      success: true,
      data: {
        instructions,
        cached: false,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    return handleApiError(err, c, "TRANSFORM_FAILED");
  }
});

// ── Explain ──

app.post("/api/explain", async (c) => {
  const body = await c.req.json<{
    text: string;
    context: string;
    url?: string;
    readingLevel?: string;
  }>();

  if (!body.text || typeof body.text !== "string") {
    return validationError(c, "text is required and must be a string");
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return validationError(c, `text exceeds maximum length of ${MAX_TEXT_LENGTH}`);
  }
  if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
    return validationError(c, "invalid readingLevel");
  }

  const pageUrl = body.url ?? "";
  const startTime = Date.now();

  // Check response cache first (keyed by URL + text)
  const cached = getCachedResponse(pageUrl, body.text);
  if (cached) {
    return c.json({
      success: true,
      data: {
        answer: cached.response,
        cached: true,
        responseId: cached.id,
        editedBy: cached.editedBy ?? null,
        processingMs: Date.now() - startTime,
      },
    });
  }

  try {
    const answer = await explainText(
      body.text,
      body.context?.slice(0, 1000) ?? "",
      body.readingLevel
    );

    // Cache the response keyed by URL + text
    const entry = setCachedResponse(pageUrl, body.text, answer);

    return c.json({
      success: true,
      data: {
        answer,
        cached: false,
        responseId: entry.id,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    return handleApiError(err, c, "EXPLAIN_FAILED");
  }
});

// ── Benefits Evaluation ──

app.post("/api/benefits/evaluate", async (c) => {
  const body = await c.req.json<{
    profile: {
      incomeBracket: string | null;
      state: string | null;
      householdSize: number | null;
      hasDisability: boolean | null;
      veteranStatus: boolean | null;
      ageBracket: string | null;
    };
    readingLevel?: string;
  }>();

  if (!body.profile || typeof body.profile !== "object") {
    return validationError(c, "profile is required");
  }
  if (body.profile.incomeBracket && !VALID_INCOME_BRACKETS.has(body.profile.incomeBracket)) {
    return validationError(c, "invalid incomeBracket");
  }
  if (body.profile.ageBracket && !VALID_AGE_BRACKETS.has(body.profile.ageBracket)) {
    return validationError(c, "invalid ageBracket");
  }
  if (body.profile.householdSize != null && (body.profile.householdSize < 1 || body.profile.householdSize > 20)) {
    return validationError(c, "householdSize must be between 1 and 20");
  }
  if (body.profile.state && (typeof body.profile.state !== "string" || body.profile.state.length !== 2)) {
    return validationError(c, "state must be a 2-letter code");
  }
  if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
    return validationError(c, "invalid readingLevel");
  }

  const startTime = Date.now();

  try {
    // Step 1: Deterministic rules engine
    const eligibilityResults = evaluateEligibility(body.profile, FEDERAL_RULES);

    // Step 2: AI ranking and plain-language explanations
    const recommendations = await rankAndExplainBenefits(
      eligibilityResults,
      body.profile,
      body.readingLevel
    );

    return c.json({
      success: true,
      data: {
        recommendations,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    return handleApiError(err, c, "BENEFITS_FAILED");
  }
});

// ── Form Guidance ──

const MAX_FORM_FIELDS = 50;

app.post("/api/form-guidance", async (c) => {
  const body = await c.req.json<{
    url: string;
    pageTitle: string;
    fields: Array<{
      selector: string;
      tagName: string;
      inputType: string;
      label: string;
      name: string;
      placeholder: string;
      required: boolean;
      options?: string[];
    }>;
    readingLevel?: string;
  }>();

  if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
    return validationError(c, "fields is required and must be a non-empty array");
  }
  if (body.fields.length > MAX_FORM_FIELDS) {
    return validationError(c, `fields exceeds maximum of ${MAX_FORM_FIELDS}`);
  }
  if (!body.url || typeof body.url !== "string") {
    return validationError(c, "url is required and must be a string");
  }
  if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
    return validationError(c, "invalid readingLevel");
  }

  const startTime = Date.now();

  try {
    const guidance = await generateFormGuidance(
      body.fields,
      body.url,
      body.pageTitle ?? "",
      body.readingLevel
    );

    return c.json({
      success: true,
      data: {
        guidance,
        cached: false,
        processingMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    return handleApiError(err, c, "FORM_GUIDANCE_FAILED");
  }
});

// ── Events (enriched with location data for feedback loop) ──

const EVENT_TYPE_MAP: Record<string, InteractionType> = {
  transform_accepted: "simplified",
  highlight_ask: "asked",
  form_guidance_used: "form-help",
};

app.post("/api/events", async (c) => {
  try {
    const body = await c.req.json<{
      eventType: string;
      context: Record<string, unknown>;
    }>();

    const mappedType = EVENT_TYPE_MAP[body.eventType];
    if (mappedType && body.context?.url) {
      const url = body.context.url as string;
      const parsed = new URL(url);

      // For events with multiple selectors (transforms, form help), store one per selector
      const selectors = (body.context.selectors as string[]) ?? [];
      const singleSelector = (body.context.selector as string) ?? "";
      const allSelectors = selectors.length > 0 ? selectors : singleSelector ? [singleSelector] : ["body"];

      const response = (body.context.response as string) ?? undefined;

      for (const selector of allSelectors.slice(0, 30)) {
        addInteraction({
          domain: parsed.hostname,
          urlPath: parsed.pathname,
          fullUrl: url,
          selector,
          eventType: mappedType,
          content: (body.context.text as string) ?? "",
          response,
        });
      }
    }

    return c.json({ success: true, data: { id: crypto.randomUUID() } });
  } catch {
    return c.json({ success: true, data: { id: crypto.randomUUID() } });
  }
});

// ── User Feedback (anchored comments) ──

const MAX_COMMENT_LENGTH = 2000;

app.post("/api/feedback", async (c) => {
  const body = await c.req.json<{
    url: string;
    selector: string;
    comment: string;
    selectedText?: string;
  }>();

  if (!body.comment || typeof body.comment !== "string") {
    return validationError(c, "comment is required and must be a string");
  }
  if (body.comment.length > MAX_COMMENT_LENGTH) {
    return validationError(c, `comment exceeds maximum length of ${MAX_COMMENT_LENGTH}`);
  }
  if (!body.url || typeof body.url !== "string") {
    return validationError(c, "url is required and must be a string");
  }

  try {
    const parsed = new URL(body.url);
    const { category, confidence } = await categorizeFeedback(
      body.comment,
      body.url,
      body.selector ?? "body"
    );

    const interaction = addInteraction({
      domain: parsed.hostname,
      urlPath: parsed.pathname,
      fullUrl: body.url,
      selector: body.selector ?? "body",
      eventType: "comment",
      content: body.comment,
      category,
    });

    return c.json({
      success: true,
      data: { id: interaction.id, category, confidence },
    });
  } catch (err) {
    return handleApiError(err, c, "FEEDBACK_FAILED");
  }
});

// ── Dashboard (site owner view, no API key required) ──

// Page proxy must be registered before :domain param route
app.get("/dashboard/proxy", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("url query parameter required", 400);

  try {
    const parsed = new URL(url);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IvyDashboard/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) return c.text(`Failed to fetch: ${response.status}`, 502);

    let html = await response.text();

    // Strip script tags for safety
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

    // Convert relative URLs to absolute
    const base = `${parsed.protocol}//${parsed.host}`;
    html = html.replace(
      /(<(?:link|img|a|source|video|audio)\b[^>]*?\s(?:href|src|srcset))="(?!(?:https?:|data:|#|javascript:))(\/?)([^"]*?)"/gi,
      (_, prefix, slash, path) =>
        `${prefix}="${slash ? base + "/" : base + parsed.pathname.replace(/[^/]*$/, "")}${path}"`
    );

    // Inject a <base> tag so remaining relative resources resolve correctly
    html = html.replace(
      /(<head[^>]*>)/i,
      `$1<base href="${base}${parsed.pathname}" />`
    );

    return c.html(html);
  } catch (err) {
    return c.text(`Proxy error: ${err instanceof Error ? err.message : "unknown"}`, 502);
  }
});

app.get("/dashboard/:domain", (c) => {
  const domain = c.req.param("domain");
  const insights = getAggregatedInsights(domain);
  return c.json({ success: true, data: insights });
});

app.get("/dashboard/:domain/page", (c) => {
  const domain = c.req.param("domain");
  const path = c.req.query("path") ?? "/";
  const insights = getPageInsights(domain, path);
  return c.json({ success: true, data: insights });
});

// ── Response Management (for dashboard) ──

app.get("/dashboard/responses", (c) => {
  const responses = getAllCachedResponses();
  return c.json({ success: true, data: responses });
});

app.put("/dashboard/responses/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ response: string; editedBy?: string }>();

  if (!body.response || typeof body.response !== "string") {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "response is required" } }, 400);
  }

  const updated = updateCachedResponse(id, body.response, body.editedBy);
  if (!updated) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Response not found" } }, 404);
  }

  return c.json({ success: true, data: updated });
});

// ── Health ──

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ivy-server",
    timestamp: new Date().toISOString(),
  });
});

// ── Start ──

const port = parseInt(process.env.PORT ?? "3001", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Ivy server running on http://localhost:${port}`);
});
