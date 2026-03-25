// ── User & Profile ──

export interface User {
  id: string;
  clerkId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  userId: string;
  readingLevel: ReadingLevel;
  language: string;
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  jargonLevel: JargonLevel;
  customNeeds: string[];
}

export type ReadingLevel = "elementary" | "middle-school" | "high-school" | "college" | "original";
export type JargonLevel = "none" | "minimal" | "moderate" | "original";

// ── PII Classification ──

export type PIICategory = "public" | "preferences" | "sensitive" | "vault";

export interface EligibilityProfile {
  userId: string;
  incomeBracket: string | null;
  state: string | null;
  householdSize: number | null;
  hasDisability: boolean | null;
  veteranStatus: boolean | null;
  ageBracket: string | null;
}

/** Input for the benefits eligibility engine (EligibilityProfile without userId) */
export type EligibilityInput = Omit<EligibilityProfile, "userId">;

// ── Content Transformation ──

export interface TransformInstruction {
  selector: string;
  action: "replace" | "wrap" | "annotate" | "style" | "remove";
  value: string;
  metadata?: Record<string, unknown>;
}

export interface TransformRequest {
  url: string;
  content: string;
  preferences: UserPreferences;
  pageRegions?: PageRegion[];
}

export interface TransformResponse {
  instructions: TransformInstruction[];
  cached: boolean;
  processingMs: number;
}

export interface PageRegion {
  selector: string;
  type: "heading" | "paragraph" | "form" | "navigation" | "image" | "table" | "list" | "unknown";
  content: string;
}

// ── Benefits ──

export interface Benefit {
  id: string;
  name: string;
  agency: string;
  description: string;
  category: BenefitCategory;
  state: string | null; // null = federal
  url: string;
}

export type BenefitCategory =
  | "food"
  | "housing"
  | "healthcare"
  | "income"
  | "education"
  | "childcare"
  | "disability"
  | "veteran"
  | "senior"
  | "utility";

export type EligibilityStatus = "likely" | "possible" | "check";

export interface BenefitRecommendation {
  benefitId: string;
  benefit: Benefit;
  eligibility: EligibilityStatus;
  explanation: string;
  confidence: number;
}

// ── Behavioral Events ──

export interface BehavioralEvent {
  id: string;
  userId: string;
  eventType: BehavioralEventType;
  context: Record<string, unknown>;
  embeddingId: string | null;
  createdAt: Date;
}

export type BehavioralEventType =
  | "transform_accepted"
  | "transform_rejected"
  | "transform_adjusted"
  | "highlight_ask"
  | "time_on_content"
  | "preference_changed";

// ── Form Detection ──

export interface ExtractedFormField {
  selector: string;
  tagName: string;
  inputType: string;
  label: string;
  name: string;
  placeholder: string;
  required: boolean;
  options?: string[];
}

// ── Form Guidance ──

export interface FormFieldGuidance {
  selector: string;
  label: string;
  explanation: string;
  example?: string;
  required: boolean;
  vaultField?: string; // maps to vault entry for auto-fill
}

export interface FormGuidance {
  urlPattern: string;
  title: string;
  fields: FormFieldGuidance[];
}

// ── Vault (Client-Side Encrypted) ──

export interface VaultEntry {
  id: string;
  userId: string;
  category: "personal" | "financial" | "medical" | "contact";
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  createdAt: Date;
  updatedAt: Date;
}

// ── API ──

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
