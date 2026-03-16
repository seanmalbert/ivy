/**
 * Typed message protocol for Chrome extension inter-context communication.
 * Used between: Service Worker ↔ Content Script ↔ Sidebar ↔ Popup
 */

import type { TransformInstruction, UserPreferences, PageRegion, BenefitRecommendation } from "./types.js";

// ── Message types ──

export type IvyMessage =
  | TransformPageMessage
  | TransformResultMessage
  | HighlightAskMessage
  | HighlightAnswerMessage
  | PreferencesUpdatedMessage
  | ToggleIvyMessage
  | GetPageContentMessage
  | PageContentMessage
  | AuthStateMessage
  | EvaluateBenefitsMessage
  | BenefitsResultMessage
  | ErrorMessage;

// ── Transform messages ──

export interface TransformPageMessage {
  type: "TRANSFORM_PAGE";
  payload: {
    url: string;
    content: string;
    regions: PageRegion[];
  };
}

export interface TransformResultMessage {
  type: "TRANSFORM_RESULT";
  payload: {
    instructions: TransformInstruction[];
    cached: boolean;
    processingMs: number;
  };
}

// ── Highlight & Ask ──

export interface HighlightAskMessage {
  type: "HIGHLIGHT_ASK";
  payload: {
    selectedText: string;
    context: string; // surrounding paragraph
    question?: string;
  };
}

export interface HighlightAnswerMessage {
  type: "HIGHLIGHT_ANSWER";
  payload: {
    answer: string;
    simplified?: string;
  };
}

// ── Preferences ──

export interface PreferencesUpdatedMessage {
  type: "PREFERENCES_UPDATED";
  payload: UserPreferences;
}

// ── Toggle ──

export interface ToggleIvyMessage {
  type: "TOGGLE_IVY";
  payload: {
    enabled: boolean;
  };
}

// ── Page content extraction ──

export interface GetPageContentMessage {
  type: "GET_PAGE_CONTENT";
  payload: Record<string, never>;
}

export interface PageContentMessage {
  type: "PAGE_CONTENT";
  payload: {
    url: string;
    title: string;
    content: string;
    regions: PageRegion[];
  };
}

// ── Auth ──

export interface AuthStateMessage {
  type: "AUTH_STATE";
  payload: {
    isAuthenticated: boolean;
    userId?: string;
  };
}

// ── Benefits ──

export interface EvaluateBenefitsMessage {
  type: "EVALUATE_BENEFITS";
  payload: {
    profile: {
      incomeBracket: string | null;
      state: string | null;
      householdSize: number | null;
      hasDisability: boolean | null;
      veteranStatus: boolean | null;
      ageBracket: string | null;
    };
  };
}

export interface BenefitsResultMessage {
  type: "BENEFITS_RESULT";
  payload: {
    recommendations: BenefitRecommendation[];
    processingMs: number;
  };
}

// ── Error ──

export interface ErrorMessage {
  type: "ERROR";
  payload: {
    code: string;
    message: string;
    source: "content-script" | "service-worker" | "sidebar" | "popup";
  };
}

// ── Helpers ──

export function createMessage<T extends IvyMessage>(type: T["type"], payload: T["payload"]): T {
  return { type, payload } as T;
}

export function isIvyMessage(msg: unknown): msg is IvyMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    "payload" in msg &&
    typeof (msg as IvyMessage).type === "string"
  );
}
