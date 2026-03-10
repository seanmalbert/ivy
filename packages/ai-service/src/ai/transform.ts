import Anthropic from "@anthropic-ai/sdk";
import type { TransformInstruction } from "@ivy/shared";
import { READING_LEVEL_GRADES } from "@ivy/shared";

const anthropic = new Anthropic();

interface PageRegion {
  selector: string;
  type: string;
  content: string;
}

export async function streamText(
  content: string,
  preferences: Record<string, unknown>,
  regions?: PageRegion[]
): Promise<TransformInstruction[]> {
  const readingLevel = (preferences.readingLevel as string) ?? "original";
  if (readingLevel === "original" && !preferences.highContrast) {
    return [];
  }

  const gradeTarget = READING_LEVEL_GRADES[readingLevel] ?? 99;
  const jargonLevel = (preferences.jargonLevel as string) ?? "original";

  const regionContext = regions
    ? regions
        .slice(0, 20)
        .map((r) => `[${r.type}] ${r.selector}: ${r.content.slice(0, 300)}`)
        .join("\n\n")
    : content.slice(0, 10000);

  const systemPrompt = `You are Ivy, an AI that transforms web content for accessibility. You output JSON arrays of DOM transformation instructions.

Each instruction has: { "selector": CSS selector, "action": "replace"|"wrap"|"annotate"|"style"|"remove", "value": string }

Rules:
- Simplify text to grade level ${gradeTarget} (1-12 scale)
- ${jargonLevel === "none" ? "Add tooltips for ALL technical/jargon terms using 'annotate' action" : jargonLevel === "minimal" ? "Add tooltips only for difficult jargon terms" : "Do not add jargon tooltips"}
- Preserve the meaning and key information
- Use real CSS selectors that would match the page elements
- Keep instructions minimal — only transform what needs changing
- Output ONLY a valid JSON array, no markdown or explanation`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Transform this web content:\n\n${regionContext}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as TransformInstruction[];
  } catch {
    return [];
  }
}
