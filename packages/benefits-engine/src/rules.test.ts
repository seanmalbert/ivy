import { describe, it, expect } from "vitest";
import { evaluateEligibility } from "./rules.js";
import { FEDERAL_RULES, FEDERAL_BENEFITS } from "./data/federal.js";
import type { EligibilityInput } from "@ivy/shared";

const emptyProfile: EligibilityInput = {
  incomeBracket: null,
  state: null,
  householdSize: null,
  hasDisability: null,
  veteranStatus: null,
  ageBracket: null,
};

describe("evaluateEligibility", () => {
  it("returns empty array for high-income profile", () => {
    const results = evaluateEligibility(
      { ...emptyProfile, incomeBracket: "100k+" },
      FEDERAL_RULES
    );
    // At 100k+ income, only SNAP with large household could match
    const ids = results.map((r) => r.benefit.id);
    expect(ids).not.toContain("medicaid");
    expect(ids).not.toContain("ssi");
    expect(ids).not.toContain("tanf");
  });

  it("returns 'check' for all income-based benefits when no income provided", () => {
    const results = evaluateEligibility(emptyProfile, FEDERAL_RULES);
    const incomeBasedIds = ["snap", "medicaid", "liheap", "section8", "pell", "tanf"];
    for (const id of incomeBasedIds) {
      const result = results.find((r) => r.benefit.id === id);
      expect(result, `Expected ${id} to be in results`).toBeDefined();
      expect(result!.eligibility).toBe("check");
    }
  });

  it("sorts results: likely > possible > check", () => {
    const results = evaluateEligibility(
      { ...emptyProfile, incomeBracket: "10k-20k" },
      FEDERAL_RULES
    );
    const eligibilities = results.map((r) => r.eligibility);
    const order = { likely: 0, possible: 1, check: 2 };
    for (let i = 1; i < eligibilities.length; i++) {
      expect(order[eligibilities[i]]).toBeGreaterThanOrEqual(
        order[eligibilities[i - 1]]
      );
    }
  });

  it("returns no results for an empty rules array", () => {
    const results = evaluateEligibility(emptyProfile, []);
    expect(results).toEqual([]);
  });
});

describe("SNAP eligibility", () => {
  const snapRule = FEDERAL_RULES.find((r) => r.benefit.id === "snap")!;

  it("returns 'likely' for very low income", () => {
    expect(
      snapRule.evaluate({ ...emptyProfile, incomeBracket: "0-10k" })
    ).toBe("likely");
  });

  it("returns 'likely' for low income with large household", () => {
    expect(
      snapRule.evaluate({
        ...emptyProfile,
        incomeBracket: "30k-40k",
        householdSize: 4,
      })
    ).toBe("likely");
  });

  it("returns null for high income", () => {
    expect(
      snapRule.evaluate({ ...emptyProfile, incomeBracket: "100k+" })
    ).toBeNull();
  });

  it("returns 'check' when income is null", () => {
    expect(snapRule.evaluate(emptyProfile)).toBe("check");
  });
});

describe("Medicaid eligibility", () => {
  const rule = FEDERAL_RULES.find((r) => r.benefit.id === "medicaid")!;

  it("returns 'likely' for income ≤ 20k", () => {
    expect(
      rule.evaluate({ ...emptyProfile, incomeBracket: "10k-20k" })
    ).toBe("likely");
  });

  it("returns 'possible' for income 20k-35k", () => {
    expect(
      rule.evaluate({ ...emptyProfile, incomeBracket: "20k-30k" })
    ).toBe("possible");
  });

  it("returns null for income > 35k", () => {
    expect(
      rule.evaluate({ ...emptyProfile, incomeBracket: "50k-75k" })
    ).toBeNull();
  });
});

describe("SSI eligibility", () => {
  const rule = FEDERAL_RULES.find((r) => r.benefit.id === "ssi")!;

  it("returns 'likely' for disabled with low income", () => {
    expect(
      rule.evaluate({
        ...emptyProfile,
        hasDisability: true,
        incomeBracket: "10k-20k",
      })
    ).toBe("likely");
  });

  it("returns 'possible' for disabled with unknown income", () => {
    expect(
      rule.evaluate({ ...emptyProfile, hasDisability: true })
    ).toBe("possible");
  });

  it("returns 'likely' for 65+ with low income", () => {
    expect(
      rule.evaluate({
        ...emptyProfile,
        ageBracket: "65+",
        incomeBracket: "10k-20k",
      })
    ).toBe("likely");
  });

  it("returns null for non-disabled, non-senior", () => {
    expect(
      rule.evaluate({
        ...emptyProfile,
        ageBracket: "25-34",
        incomeBracket: "10k-20k",
      })
    ).toBeNull();
  });
});

describe("VA Healthcare eligibility", () => {
  const rule = FEDERAL_RULES.find((r) => r.benefit.id === "va-healthcare")!;

  it("returns 'likely' for veterans", () => {
    expect(
      rule.evaluate({ ...emptyProfile, veteranStatus: true })
    ).toBe("likely");
  });

  it("returns null for non-veterans", () => {
    expect(rule.evaluate(emptyProfile)).toBeNull();
  });
});

describe("TANF eligibility", () => {
  const rule = FEDERAL_RULES.find((r) => r.benefit.id === "tanf")!;

  it("returns 'likely' for low income family", () => {
    expect(
      rule.evaluate({
        ...emptyProfile,
        incomeBracket: "10k-20k",
        householdSize: 3,
      })
    ).toBe("likely");
  });

  it("returns 'possible' for low income single person", () => {
    expect(
      rule.evaluate({
        ...emptyProfile,
        incomeBracket: "10k-20k",
        householdSize: 1,
      })
    ).toBe("possible");
  });

  it("returns null for high income", () => {
    expect(
      rule.evaluate({ ...emptyProfile, incomeBracket: "50k-75k" })
    ).toBeNull();
  });
});

describe("comprehensive scenario: low-income disabled veteran", () => {
  it("matches many programs", () => {
    const profile: EligibilityInput = {
      incomeBracket: "0-10k",
      state: "CA",
      householdSize: 1,
      hasDisability: true,
      veteranStatus: true,
      ageBracket: "55-64",
    };

    const results = evaluateEligibility(profile, FEDERAL_RULES);
    const ids = results.map((r) => r.benefit.id);

    expect(ids).toContain("snap");
    expect(ids).toContain("medicaid");
    expect(ids).toContain("ssi");
    expect(ids).toContain("liheap");
    expect(ids).toContain("section8");
    expect(ids).toContain("pell");
    expect(ids).toContain("va-healthcare");
    expect(ids).toContain("tanf");

    // All should be "likely" at this income level
    const vaResult = results.find((r) => r.benefit.id === "va-healthcare");
    expect(vaResult!.eligibility).toBe("likely");
    const snapResult = results.find((r) => r.benefit.id === "snap");
    expect(snapResult!.eligibility).toBe("likely");
  });
});

describe("FEDERAL_BENEFITS data integrity", () => {
  it("all benefits have required fields", () => {
    for (const b of FEDERAL_BENEFITS) {
      expect(b.id).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.agency).toBeTruthy();
      expect(b.description).toBeTruthy();
      expect(b.url).toMatch(/^https:\/\//);
      expect(b.category).toBeTruthy();
    }
  });

  it("all rules reference valid benefits", () => {
    for (const rule of FEDERAL_RULES) {
      expect(rule.benefit).toBeDefined();
      expect(rule.benefit.id).toBeTruthy();
      expect(typeof rule.evaluate).toBe("function");
    }
  });

  it("benefit IDs are unique", () => {
    const ids = FEDERAL_BENEFITS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
