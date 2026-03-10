import type { Benefit, EligibilityStatus } from "@ivy/shared";

export interface EligibilityInput {
  incomeBracket: string | null;
  state: string | null;
  householdSize: number | null;
  hasDisability: boolean | null;
  veteranStatus: boolean | null;
  ageBracket: string | null;
}

export interface BenefitRule {
  benefit: Benefit;
  evaluate: (input: EligibilityInput) => EligibilityStatus | null;
}

export interface EligibilityResult {
  benefit: Benefit;
  eligibility: EligibilityStatus;
}

/**
 * Deterministic rules engine for benefits eligibility.
 * AI is NOT used here — it's used downstream for ranking and explanation only.
 */
export function evaluateEligibility(
  input: EligibilityInput,
  rules: BenefitRule[]
): EligibilityResult[] {
  const results: EligibilityResult[] = [];

  for (const rule of rules) {
    const status = rule.evaluate(input);
    if (status) {
      results.push({ benefit: rule.benefit, eligibility: status });
    }
  }

  // Sort: likely > possible > check
  const order: Record<EligibilityStatus, number> = {
    likely: 0,
    possible: 1,
    check: 2,
  };

  return results.sort((a, b) => order[a.eligibility] - order[b.eligibility]);
}
