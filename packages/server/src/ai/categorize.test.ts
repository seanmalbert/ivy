import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

import { categorizeFeedback } from "./categorize.js";

function mockAIResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text }],
  });
}

describe("categorizeFeedback", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns the AI-assigned category and confidence", async () => {
    mockAIResponse(JSON.stringify({ category: "confusing-language", confidence: 0.9 }));

    const result = await categorizeFeedback("This is really hard to read", "https://ssa.gov", "#main");
    expect(result.category).toBe("confusing-language");
    expect(result.confidence).toBe(0.9);
  });

  it("falls back to 'other' for unrecognized category", async () => {
    mockAIResponse(JSON.stringify({ category: "unknown-category", confidence: 0.8 }));

    const result = await categorizeFeedback("test", "https://example.com", "body");
    expect(result.category).toBe("other");
  });

  it("clamps confidence to [0, 1]", async () => {
    mockAIResponse(JSON.stringify({ category: "positive", confidence: 1.5 }));

    const result = await categorizeFeedback("Great site!", "https://example.com", "body");
    expect(result.confidence).toBe(1);
  });

  it("falls back on invalid JSON", async () => {
    mockAIResponse("I cannot categorize this.");

    const result = await categorizeFeedback("test", "https://example.com", "body");
    expect(result.category).toBe("other");
    expect(result.confidence).toBe(0.5);
  });

  it("falls back on non-text response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const result = await categorizeFeedback("test", "https://example.com", "body");
    expect(result.category).toBe("other");
  });

  it("falls back on API error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API down"));

    const result = await categorizeFeedback("test", "https://example.com", "body");
    expect(result.category).toBe("other");
    expect(result.confidence).toBe(0.5);
  });

  it("accepts all valid categories", async () => {
    for (const cat of ["confusing-language", "missing-info", "broken-feature", "accessibility", "navigation", "positive", "other"]) {
      mockAIResponse(JSON.stringify({ category: cat, confidence: 0.7 }));
      const result = await categorizeFeedback("test", "https://example.com", "body");
      expect(result.category).toBe(cat);
    }
  });

  it("includes URL and selector in the prompt", async () => {
    mockAIResponse(JSON.stringify({ category: "navigation", confidence: 0.6 }));

    await categorizeFeedback("Can't find the form", "https://ssa.gov/apply", "#sidebar");

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("ssa.gov/apply");
    expect(call.messages[0].content).toContain("#sidebar");
  });
});
