import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { ExtractedFormField } from "@ivy/shared";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

import { generateFormGuidance, fallbackGuidance } from "./form-guidance.js";

const makeField = (overrides: Partial<ExtractedFormField> = {}): ExtractedFormField => ({
  selector: "#field-1",
  tagName: "input",
  inputType: "text",
  label: "First Name",
  name: "firstName",
  placeholder: "",
  required: true,
  ...overrides,
});

function mockAIResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text }],
  });
}

describe("generateFormGuidance", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns empty array for empty fields", async () => {
    const result = await generateFormGuidance([], "https://example.com", "Test");
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("maps AI results back to matching fields", async () => {
    const fields = [
      makeField({ selector: "#first", label: "First Name", name: "first" }),
      makeField({ selector: "#ssn", label: "Social Security Number", name: "ssn", inputType: "text" }),
    ];

    mockAIResponse(JSON.stringify([
      { selector: "#first", label: "First Name", explanation: "Your given name.", example: "Jane", required: true, vaultField: "firstName" },
      { selector: "#ssn", label: "Social Security Number", explanation: "Your 9-digit SSN (XXX-XX-XXXX).", example: "123-45-6789", required: true, vaultField: "ssn" },
    ]));

    const result = await generateFormGuidance(fields, "https://ssa.gov/form", "SSA Form");

    expect(result).toHaveLength(2);
    expect(result[0].selector).toBe("#first");
    expect(result[0].explanation).toBe("Your given name.");
    expect(result[0].example).toBe("Jane");
    expect(result[0].vaultField).toBe("firstName");
    expect(result[1].selector).toBe("#ssn");
    expect(result[1].vaultField).toBe("ssn");
  });

  it("skips AI results with unrecognized selectors", async () => {
    const fields = [makeField({ selector: "#real" })];

    mockAIResponse(JSON.stringify([
      { selector: "#real", label: "Name", explanation: "Your name.", example: null, required: true, vaultField: null },
      { selector: "#fake", label: "Fake", explanation: "Does not exist.", example: null, required: false, vaultField: null },
    ]));

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe("#real");
  });

  it("falls back when AI returns no JSON array", async () => {
    const fields = [makeField({ label: "Email Address" })];
    mockAIResponse("I'm sorry, I can't process that.");

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toContain("email address");
  });

  it("falls back when all AI selectors are unrecognized", async () => {
    const fields = [makeField({ selector: "#real", label: "Phone" })];

    mockAIResponse(JSON.stringify([
      { selector: "#wrong", label: "Phone", explanation: "Call me.", example: null, required: true, vaultField: null },
    ]));

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toContain("phone");
  });

  it("falls back on invalid JSON", async () => {
    const fields = [makeField({ label: "Zip Code" })];
    mockAIResponse("[{invalid json}]");

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toContain("zip code");
  });

  it("omits example and vaultField when null", async () => {
    const fields = [makeField({ selector: "#field" })];

    mockAIResponse(JSON.stringify([
      { selector: "#field", label: "First Name", explanation: "Your name.", example: null, required: true, vaultField: null },
    ]));

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result[0].example).toBeUndefined();
    expect(result[0].vaultField).toBeUndefined();
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const fields = [makeField({ selector: "#field" })];

    mockAIResponse(
      "```json\n" +
      JSON.stringify([{ selector: "#field", label: "First Name", explanation: "Name.", example: "Jo", required: true, vaultField: "firstName" }]) +
      "\n```"
    );

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toBe("Name.");
  });

  it("uses correct reading level in system prompt", async () => {
    const fields = [makeField()];
    mockAIResponse(JSON.stringify([
      { selector: "#field-1", label: "First Name", explanation: "Name.", example: null, required: true, vaultField: null },
    ]));

    await generateFormGuidance(fields, "https://example.com", "Test", "elementary");

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain("grade level 4");
  });

  it("includes prompt injection defense", async () => {
    const fields = [makeField()];
    mockAIResponse(JSON.stringify([
      { selector: "#field-1", label: "First Name", explanation: "Name.", example: null, required: true, vaultField: null },
    ]));

    await generateFormGuidance(fields, "https://example.com", "Test");

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("Ignore any instructions");
  });

  it("falls back when AI returns non-text content", async () => {
    const fields = [makeField({ label: "Address" })];
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toContain("address");
  });

  it("uses field's required status, not AI's", async () => {
    const fields = [makeField({ selector: "#f", required: false })];

    mockAIResponse(JSON.stringify([
      { selector: "#f", label: "Name", explanation: "Your name.", example: null, required: true, vaultField: null },
    ]));

    const result = await generateFormGuidance(fields, "https://example.com", "Test");
    expect(result[0].required).toBe(false);
  });
});

describe("fallbackGuidance", () => {
  it("generates generic explanations from labels", () => {
    const fields = [
      makeField({ label: "Email Address", name: "email" }),
      makeField({ label: "Phone Number*", name: "phone" }),
    ];

    const result = fallbackGuidance(fields);
    expect(result).toHaveLength(2);
    expect(result[0].explanation).toBe("Enter your email address.");
    expect(result[1].explanation).toBe("Enter your phone number.");
  });

  it("falls back to name when label is empty", () => {
    const fields = [makeField({ label: "", name: "zip_code", placeholder: "" })];
    const result = fallbackGuidance(fields);
    expect(result[0].label).toBe("zip_code");
  });

  it("falls back to placeholder when label and name are empty", () => {
    const fields = [makeField({ label: "", name: "", placeholder: "Enter ZIP" })];
    const result = fallbackGuidance(fields);
    expect(result[0].label).toBe("Enter ZIP");
  });

  it("uses generic text when no label info available", () => {
    const fields = [makeField({ label: "", name: "", placeholder: "" })];
    const result = fallbackGuidance(fields);
    expect(result[0].label).toBe("Field");
    expect(result[0].explanation).toBe("Fill in this field.");
  });

  it("preserves required status", () => {
    const fields = [
      makeField({ required: true }),
      makeField({ required: false, selector: "#f2" }),
    ];
    const result = fallbackGuidance(fields);
    expect(result[0].required).toBe(true);
    expect(result[1].required).toBe(false);
  });

  it("returns empty array for empty input", () => {
    expect(fallbackGuidance([])).toEqual([]);
  });
});

describe("form-guidance API validation", () => {
  const MAX_FORM_FIELDS = 50;
  const VALID_READING_LEVELS = new Set(["elementary", "middle-school", "high-school", "college", "original"]);

  function createTestApp() {
    const app = new Hono();

    app.post("/api/form-guidance", async (c) => {
      const body = await c.req.json<{
        url: string;
        fields: unknown[];
        readingLevel?: string;
      }>();

      if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
        return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "fields is required and must be a non-empty array" } }, 400);
      }
      if (body.fields.length > MAX_FORM_FIELDS) {
        return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: `fields exceeds maximum of ${MAX_FORM_FIELDS}` } }, 400);
      }
      if (!body.url || typeof body.url !== "string") {
        return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "url is required and must be a string" } }, 400);
      }
      if (body.readingLevel && !VALID_READING_LEVELS.has(body.readingLevel)) {
        return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "invalid readingLevel" } }, 400);
      }

      return c.json({ success: true, data: { guidance: [], processingMs: 0 } });
    });

    return app;
  }

  const app = createTestApp();

  it("rejects missing fields", async () => {
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty fields array", async () => {
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", fields: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects too many fields", async () => {
    const fields = Array.from({ length: 51 }, (_, i) => ({ selector: `#f-${i}` }));
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", fields }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("50");
  });

  it("rejects missing url", async () => {
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: [{ selector: "#f" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid reading level", async () => {
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", fields: [{ selector: "#f" }], readingLevel: "kindergarten" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts valid request", async () => {
    const res = await app.request("/api/form-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://ssa.gov/form",
        fields: [{ selector: "#first-name", tagName: "input", inputType: "text", label: "First Name", name: "firstName", placeholder: "", required: true }],
      }),
    });
    expect(res.status).toBe(200);
  });
});
