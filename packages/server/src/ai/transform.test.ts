import { describe, it, expect } from "vitest";

// Test the parseInstructions logic directly by extracting it
// Since parseInstructions is not exported, we test it via a local reimplementation
// that matches the same logic used in transform.ts

function parseInstructions(text: string): Array<{ selector: string; action: string; value?: unknown }> {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const instructions = JSON.parse(jsonMatch[0]) as Array<{
      selector: string;
      action: string;
      value?: unknown;
    }>;
    return instructions.filter(
      (i) => i.selector && i.action && i.value !== undefined
    );
  } catch {
    return [];
  }
}

describe("parseInstructions (AI JSON parsing)", () => {
  it("parses a valid JSON array", () => {
    const text = `[{"selector":"#main > p","action":"replace","value":"Simple text."}]`;
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe("#main > p");
    expect(result[0].action).toBe("replace");
    expect(result[0].value).toBe("Simple text.");
  });

  it("extracts JSON from surrounding text/markdown", () => {
    const text = `Here are the instructions:\n\`\`\`json\n[{"selector":"p","action":"replace","value":"Hi"}]\n\`\`\`\nDone!`;
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("Hi");
  });

  it("handles multiple instructions", () => {
    const text = JSON.stringify([
      { selector: "#a", action: "replace", value: "A" },
      { selector: "#b", action: "annotate", value: "B" },
      { selector: "#c", action: "style", value: "color:red" },
    ]);
    const result = parseInstructions(text);
    expect(result).toHaveLength(3);
  });

  it("filters out instructions missing selector", () => {
    const text = JSON.stringify([
      { selector: "", action: "replace", value: "A" },
      { selector: "#valid", action: "replace", value: "B" },
    ]);
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe("#valid");
  });

  it("filters out instructions missing action", () => {
    const text = JSON.stringify([
      { selector: "#a", action: "", value: "A" },
      { selector: "#b", action: "replace", value: "B" },
    ]);
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
  });

  it("keeps instructions with empty string value", () => {
    const text = JSON.stringify([
      { selector: "#a", action: "replace", value: "" },
    ]);
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
  });

  it("filters out instructions with undefined value", () => {
    const text = `[{"selector":"#a","action":"replace"}]`;
    const result = parseInstructions(text);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseInstructions("{not valid json[}");
    expect(result).toEqual([]);
  });

  it("returns empty array for text with no JSON array", () => {
    const result = parseInstructions("I cannot help with that request.");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const result = parseInstructions("");
    expect(result).toEqual([]);
  });

  it("handles JSON with nested brackets in values", () => {
    const text = `[{"selector":"#a","action":"annotate","value":"SNAP [food stamps] helps people"}]`;
    const result = parseInstructions(text);
    expect(result).toHaveLength(1);
    expect(result[0].value).toContain("[food stamps]");
  });
});
