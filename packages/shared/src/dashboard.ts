// ── Dashboard types (shared between server and dashboard UI) ──

export type InteractionType = "simplified" | "asked" | "form-help" | "comment";

export type FeedbackCategory =
  | "confusing-language"
  | "missing-info"
  | "broken-feature"
  | "accessibility"
  | "navigation"
  | "positive"
  | "other";

export interface SelectorInsight {
  selector: string;
  eventType: InteractionType;
  count: number;
  samples: string[];
  responses: string[];
}

export interface PageInsights {
  urlPath: string;
  totalInteractions: number;
  insights: SelectorInsight[];
  topQuestions: Array<{ question: string; selector: string; count: number }>;
  categoryDistribution: Record<string, number>;
}

export interface DomainInsights {
  domain: string;
  totalInteractions: number;
  pages: PageInsights[];
}
