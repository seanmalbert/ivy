/**
 * Typed message protocol for Chrome extension inter-context communication.
 * Used between: Service Worker ↔ Content Script ↔ Sidebar ↔ Popup
 */

import type { TransformInstruction, UserPreferences, PageRegion, BenefitRecommendation, ExtractedFormField, FormFieldGuidance } from "./types.js";
export type { PageRegion } from "./types.js";

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
  | ScanForFormsMessage
  | FormDetectedMessage
  | FormGuidanceResultMessage
  | SubmitFeedbackMessage
  | UndoTransformsMessage
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
    selector?: string; // CSS selector of the highlighted element
    url?: string;
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

// ── Form Guidance ──

export interface ScanForFormsMessage {
  type: "SCAN_FOR_FORMS";
  payload: Record<string, never>;
}

export interface FormDetectedMessage {
  type: "FORM_DETECTED";
  payload: {
    url: string;
    title: string;
    fields: ExtractedFormField[];
  };
}

export interface FormGuidanceResultMessage {
  type: "FORM_GUIDANCE_RESULT";
  payload: {
    guidance: FormFieldGuidance[];
    cached: boolean;
    processingMs: number;
  };
}

// ── Feedback ──

export interface SubmitFeedbackMessage {
  type: "SUBMIT_FEEDBACK";
  payload: {
    url: string;
    selector: string;
    comment: string;
    selectedText?: string;
  };
}

// ── Undo ──

export interface UndoTransformsMessage {
  type: "UNDO_TRANSFORMS";
  payload: Record<string, never>;
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
