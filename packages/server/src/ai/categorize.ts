import Anthropic from "@anthropic-ai/sdk";
import type { FeedbackCategory } from "@ivy/shared/dashboard";

const AI_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 128;
const MODEL = "claude-haiku-4-5";

const VALID_CATEGORIES: Set<string> = new Set([
  "confusing-language",
  "missing-info",
  "broken-feature",
  "accessibility",
  "navigation",
  "positive",
  "other",
]);

const anthropic = new Anthropic({ timeout: AI_TIMEOUT_MS });

export async function categorizeFeedback(
  comment: string,
  url: string,
  selector: string
): Promise<{ category: FeedbackCategory; confidence: number }> {
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `You categorize user feedback about websites into exactly one category.

Categories:
- "confusing-language": Text is hard to understand, uses jargon, or is unclear
- "missing-info": Important details are absent or hard to find
- "broken-feature": Something does not work, has errors, or is unusable
- "accessibility": Problems with screen readers, contrast, font size, keyboard navigation
- "navigation": Hard to find things, confusing site structure, broken links
- "positive": User is expressing satisfaction or appreciation
- "other": Does not fit the above categories

Output ONLY valid JSON: { "category": string, "confidence": number }
confidence is 0.0 to 1.0. No markdown fences, no commentary.`,
      messages: [
        {
          role: "user",
          content: `Page: ${url}\nElement: ${selector}\n\nFeedback: ${comment}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { category: "other", confidence: 0.5 };

    const parsed = JSON.parse(jsonMatch[0]) as {
      category: string;
      confidence: number;
    };

    const category = VALID_CATEGORIES.has(parsed.category)
      ? (parsed.category as FeedbackCategory)
      : "other";
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

    return { category, confidence };
  } catch {
    return { category: "other", confidence: 0.5 };
  }
}
