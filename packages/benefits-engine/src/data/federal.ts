import type { Benefit } from "@ivy/shared";
import type { BenefitRule, EligibilityInput } from "../rules.js";

// ── Federal Benefit Definitions ──

export const FEDERAL_BENEFITS: Benefit[] = [
  {
    id: "snap",
    name: "SNAP (Food Stamps)",
    agency: "USDA",
    description:
      "Supplemental Nutrition Assistance Program provides food-purchasing assistance for low-income individuals and families.",
    category: "food",
    state: null,
    url: "https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program",
  },
  {
    id: "medicaid",
    name: "Medicaid",
    agency: "CMS",
    description:
      "Health coverage for eligible low-income adults, children, pregnant women, elderly adults, and people with disabilities.",
    category: "healthcare",
    state: null,
    url: "https://www.medicaid.gov/",
  },
  {
    id: "ssi",
    name: "Supplemental Security Income (SSI)",
    agency: "SSA",
    description:
      "Monthly payments to people with limited income and resources who are disabled, blind, or age 65 or older.",
    category: "income",
    state: null,
    url: "https://www.ssa.gov/ssi/",
  },
  {
    id: "liheap",
    name: "LIHEAP",
    agency: "HHS",
    description:
      "Low Income Home Energy Assistance Program helps keep families safe and healthy through energy cost assistance.",
    category: "utility",
    state: null,
    url: "https://www.acf.hhs.gov/ocs/low-income-home-energy-assistance-program-liheap",
  },
  {
    id: "section8",
    name: "Section 8 Housing Choice Vouchers",
    agency: "HUD",
    description:
      "Assists very low-income families, the elderly, and the disabled to afford decent, safe housing in the private market.",
    category: "housing",
    state: null,
    url: "https://www.hud.gov/topics/housing_choice_voucher_program_section_8",
  },
  {
    id: "pell",
    name: "Federal Pell Grant",
    agency: "ED",
    description:
      "Need-based grants to low-income undergraduate students to help them pay for college.",
    category: "education",
    state: null,
    url: "https://studentaid.gov/understand-aid/types/grants/pell",
  },
  {
    id: "wic",
    name: "WIC",
    agency: "USDA",
    description:
      "Women, Infants, and Children program provides nutrition assistance for pregnant women, new mothers, and young children.",
    category: "food",
    state: null,
    url: "https://www.fns.usda.gov/wic",
  },
  {
    id: "va-healthcare",
    name: "VA Health Care",
    agency: "VA",
    description: "Health care benefits for eligible veterans.",
    category: "veteran",
    state: null,
    url: "https://www.va.gov/health-care/",
  },
  {
    id: "chip",
    name: "CHIP",
    agency: "CMS",
    description:
      "Children's Health Insurance Program provides low-cost health coverage to children in families that earn too much for Medicaid.",
    category: "healthcare",
    state: null,
    url: "https://www.healthcare.gov/medicaid-chip/childrens-health-insurance-program/",
  },
  {
    id: "tanf",
    name: "TANF",
    agency: "HHS",
    description:
      "Temporary Assistance for Needy Families provides temporary financial assistance to low-income families.",
    category: "income",
    state: null,
    url: "https://www.acf.hhs.gov/ofa/programs/temporary-assistance-needy-families-tanf",
  },
];

// Income bracket to approximate annual income mapping
function incomeMax(bracket: string | null): number | null {
  if (!bracket) return null;
  const map: Record<string, number> = {
    "0-10k": 10000,
    "10k-20k": 20000,
    "20k-30k": 30000,
    "30k-40k": 40000,
    "40k-50k": 50000,
    "50k-75k": 75000,
    "75k-100k": 100000,
    "100k+": 150000,
  };
  return map[bracket] ?? null;
}

// ── Rules ──

export const FEDERAL_RULES: BenefitRule[] = [
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "snap")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      const threshold = 23000 + (input.householdSize ?? 1) * 5000;
      if (income <= threshold) return "likely";
      if (income <= threshold * 1.3) return "possible";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "medicaid")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      if (income <= 20000) return "likely";
      if (income <= 35000) return "possible";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "ssi")!,
    evaluate: (input: EligibilityInput) => {
      if (input.hasDisability) {
        const income = incomeMax(input.incomeBracket);
        if (income !== null && income <= 25000) return "likely";
        return "possible";
      }
      const age = input.ageBracket;
      if (age === "65+") {
        const income = incomeMax(input.incomeBracket);
        if (income !== null && income <= 25000) return "likely";
        return "possible";
      }
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "liheap")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      if (income <= 30000) return "likely";
      if (income <= 45000) return "possible";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "section8")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      if (income <= 25000) return "likely";
      if (income <= 40000) return "possible";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "pell")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      if (income <= 30000) return "likely";
      if (income <= 60000) return "possible";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "va-healthcare")!,
    evaluate: (input: EligibilityInput) => {
      if (input.veteranStatus) return "likely";
      return null;
    },
  },
  {
    benefit: FEDERAL_BENEFITS.find((b) => b.id === "tanf")!,
    evaluate: (input: EligibilityInput) => {
      const income = incomeMax(input.incomeBracket);
      if (income === null) return "check";
      if (income <= 20000 && (input.householdSize ?? 1) >= 2) return "likely";
      if (income <= 30000) return "possible";
      return null;
    },
  },
];
