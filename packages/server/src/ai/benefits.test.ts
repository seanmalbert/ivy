import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EligibilityInput, Benefit, EligibilityStatus } from "@ivy/shared";
import type { EligibilityResult } from "@ivy/benefits-engine";

// Must use vi.hoisted so the mock fn exists before vi.mock's factory runs
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

import { rankAndExplainBenefits, fallbackResults } from "./benefits.js";

const makeBenefit = (id: string, name: string): Benefit => ({
  id,
  name,
  agency: "Test Agency",
  description: `Description for ${name}`,
  category: "food",
  state: null,
  url: `https://example.com/${id}`,
});

const makeResult = (id: string, name: string, eligibility: EligibilityStatus): EligibilityResult => ({
  benefit: makeBenefit(id, name),
  eligibility,
});

function mockAIResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text }],
  });
}

const sampleProfile: EligibilityInput = {
  incomeBracket: "10k-20k",
  state: "CA",
  householdSize: 3,
  hasDisability: false,
  veteranStatus: false,
  ageBracket: "25-34",
};

describe("rankAndExplainBenefits", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns empty array for empty results", async () => {
    const result = await rankAndExplainBenefits([], sampleProfile);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("maps AI-ranked results back to full benefit objects", async () => {
    const results = [
      makeResult("snap", "SNAP", "likely"),
      makeResult("medicaid", "Medicaid", "possible"),
    ];

    mockAIResponse(JSON.stringify([
      { benefitId: "medicaid", explanation: "Helps with healthcare.", confidence: 0.7 },
      { benefitId: "snap", explanation: "Helps buy food.", confidence: 0.9 },
    ]));

    const ranked = await rankAndExplainBenefits(results, sampleProfile);

    expect(ranked).toHaveLength(2);
    // AI reordered: medicaid first, snap second
    expect(ranked[0].benefitId).toBe("medicaid");
    expect(ranked[0].explanation).toBe("Helps with healthcare.");
    expect(ranked[0].confidence).toBe(0.7);
    expect(ranked[0].benefit.name).toBe("Medicaid");
    expect(ranked[0].eligibility).toBe("possible");

    expect(ranked[1].benefitId).toBe("snap");
    expect(ranked[1].explanation).toBe("Helps buy food.");
    expect(ranked[1].confidence).toBe(0.9);
  });

  it("clamps confidence to [0, 1] range", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];

    mockAIResponse(JSON.stringify([
      { benefitId: "snap", explanation: "Food help.", confidence: 1.5 },
    ]));

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked[0].confidence).toBe(1);
  });

  it("clamps negative confidence to 0", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];

    mockAIResponse(JSON.stringify([
      { benefitId: "snap", explanation: "Food help.", confidence: -0.3 },
    ]));

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked[0].confidence).toBe(0);
  });

  it("falls back when AI returns no JSON array", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];

    mockAIResponse("I'm sorry, I can't help with that.");

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].explanation).toBe("Description for SNAP");
    expect(ranked[0].confidence).toBe(0.8); // likely fallback
  });

  it("falls back when AI returns unrecognized benefit IDs", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];

    mockAIResponse(JSON.stringify([
      { benefitId: "unknown_benefit", explanation: "Unknown.", confidence: 0.5 },
    ]));

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    // Should fall back since no IDs matched
    expect(ranked).toHaveLength(1);
    expect(ranked[0].explanation).toBe("Description for SNAP");
  });

  it("falls back when AI returns invalid JSON", async () => {
    const results = [makeResult("snap", "SNAP", "possible")];

    mockAIResponse("[{invalid json}]");

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBe(0.5); // possible fallback
  });

  it("filters out AI results that don't match any input benefit", async () => {
    const results = [
      makeResult("snap", "SNAP", "likely"),
      makeResult("medicaid", "Medicaid", "possible"),
    ];

    mockAIResponse(JSON.stringify([
      { benefitId: "snap", explanation: "Food help.", confidence: 0.9 },
      { benefitId: "nonexistent", explanation: "???", confidence: 0.1 },
      { benefitId: "medicaid", explanation: "Health help.", confidence: 0.7 },
    ]));

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.benefitId)).toEqual(["snap", "medicaid"]);
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];

    mockAIResponse(
      "Here are the results:\n```json\n" +
      JSON.stringify([{ benefitId: "snap", explanation: "Food.", confidence: 0.85 }]) +
      "\n```"
    );

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].explanation).toBe("Food.");
  });

  it("includes profile summary in AI prompt", async () => {
    const results = [makeResult("snap", "SNAP", "likely")];
    mockAIResponse(JSON.stringify([
      { benefitId: "snap", explanation: "Food.", confidence: 0.9 },
    ]));

    await rankAndExplainBenefits(results, sampleProfile, "elementary");

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("Income: 10k-20k");
    expect(call.messages[0].content).toContain("State: CA");
    expect(call.messages[0].content).toContain("Household size: 3");
    expect(call.system).toContain("grade level 4"); // elementary
  });

  it("falls back when AI returns non-text content block", async () => {
    const results = [makeResult("snap", "SNAP", "check")];

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const ranked = await rankAndExplainBenefits(results, sampleProfile);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBe(0.3); // check fallback
  });
});

describe("fallbackResults", () => {
  it("maps eligibility results with generic explanations", () => {
    const results = [
      makeResult("snap", "SNAP", "likely"),
      makeResult("medicaid", "Medicaid", "possible"),
      makeResult("ssi", "SSI", "check"),
    ];

    const fallback = fallbackResults(results);

    expect(fallback).toHaveLength(3);
    expect(fallback[0].benefitId).toBe("snap");
    expect(fallback[0].explanation).toBe("Description for SNAP");
    expect(fallback[0].confidence).toBe(0.8);

    expect(fallback[1].benefitId).toBe("medicaid");
    expect(fallback[1].confidence).toBe(0.5);

    expect(fallback[2].benefitId).toBe("ssi");
    expect(fallback[2].confidence).toBe(0.3);
  });

  it("preserves full benefit objects in fallback", () => {
    const results = [makeResult("snap", "SNAP", "likely")];
    const fallback = fallbackResults(results);

    expect(fallback[0].benefit.id).toBe("snap");
    expect(fallback[0].benefit.name).toBe("SNAP");
    expect(fallback[0].benefit.url).toBe("https://example.com/snap");
    expect(fallback[0].eligibility).toBe("likely");
  });

  it("returns empty array for empty input", () => {
    expect(fallbackResults([])).toEqual([]);
  });
});
