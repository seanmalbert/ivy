import Anthropic from "@anthropic-ai/sdk";
import type { Benefit, EligibilityStatus, BenefitRecommendation } from "@ivy/shared";

const anthropic = new Anthropic();

interface EligibilityResultInput {
  benefit: Benefit;
  eligibility: EligibilityStatus;
}

interface ProfileContext {
  incomeBracket: string | null;
  state: string | null;
  householdSize: number | null;
  hasDisability: boolean | null;
  veteranStatus: boolean | null;
  ageBracket: string | null;
}

/**
 * Uses Claude to rank benefits by impact and generate plain-language explanations.
 * The eligibility determination itself is deterministic (rules engine) — AI is only
 * used for ranking and explanation (low-stakes).
 */
export async function rankAndExplainBenefits(
  results: EligibilityResultInput[],
  profile: ProfileContext,
  readingLevel?: string
): Promise<BenefitRecommendation[]> {
  if (results.length === 0) return [];

  const gradeTarget = readingLevel === "elementary" ? 4
    : readingLevel === "middle-school" ? 7
    : readingLevel === "college" ? 12
    : 10;

  const profileSummary = [
    profile.incomeBracket ? `Income: ${profile.incomeBracket}` : null,
    profile.state ? `State: ${profile.state}` : null,
    profile.householdSize ? `Household size: ${profile.householdSize}` : null,
    profile.hasDisability ? "Has a disability" : null,
    profile.veteranStatus ? "Is a veteran" : null,
    profile.ageBracket ? `Age: ${profile.ageBracket}` : null,
  ].filter(Boolean).join(", ");

  const benefitsList = results.map((r, i) => (
    `${i + 1}. [id="${r.benefit.id}"] ${r.benefit.name} (${r.benefit.agency}) — eligibility: ${r.eligibility}\n   ${r.benefit.description}`
  )).join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: `You are Ivy, a friendly assistant that helps people understand government benefits in plain language.

You will receive a list of benefits a person may be eligible for, along with their profile. For each benefit:
1. Write a 1-2 sentence explanation of what the benefit provides and why this person might qualify — in simple, encouraging language at approximately grade level ${gradeTarget}.
2. Assign a confidence score from 0.0 to 1.0 based on how well their profile matches the benefit.
3. Rank them by impact (most helpful first).

Output ONLY a valid JSON array. Each item: { "benefitId": string, "explanation": string, "confidence": number }
IMPORTANT: The "benefitId" must exactly match the id= value shown in brackets (e.g. "snap", "medicaid", "ssi").
No markdown fences, no commentary.`,
    messages: [{
      role: "user",
      content: `<user_profile>\n${profileSummary || "Not fully provided"}\n</user_profile>\n\n<eligible_benefits>\n${benefitsList}\n</eligible_benefits>`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackResults(results);

    const ranked = JSON.parse(jsonMatch[0]) as Array<{
      benefitId: string;
      explanation: string;
      confidence: number;
    }>;

    // Map AI output back to full benefit objects
    const mapped = ranked
      .map((item) => {
        const match = results.find((r) => r.benefit.id === item.benefitId);
        if (!match) return null;
        return {
          benefitId: match.benefit.id,
          benefit: match.benefit,
          eligibility: match.eligibility,
          explanation: item.explanation,
          confidence: Math.max(0, Math.min(1, item.confidence)),
        };
      })
      .filter((r): r is BenefitRecommendation => r !== null);

    // If AI returned items but none matched our IDs, fall back
    if (mapped.length === 0 && ranked.length > 0) {
      console.warn("AI returned benefit IDs that didn't match:", ranked.map(r => r.benefitId));
      return fallbackResults(results);
    }

    return mapped;
  } catch {
    return fallbackResults(results);
  }
}

/** Fallback if AI ranking fails — return results with generic explanations */
function fallbackResults(results: EligibilityResultInput[]): BenefitRecommendation[] {
  return results.map((r) => ({
    benefitId: r.benefit.id,
    benefit: r.benefit,
    eligibility: r.eligibility,
    explanation: r.benefit.description,
    confidence: r.eligibility === "likely" ? 0.8 : r.eligibility === "possible" ? 0.5 : 0.3,
  }));
}
