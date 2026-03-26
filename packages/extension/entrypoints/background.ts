import { isIvyMessage } from "@ivy/shared/messages";
import type { IvyMessage, PageContentMessage } from "@ivy/shared/messages";
import { STORAGE_KEYS } from "@ivy/shared";
import type { TransformInstruction, FormFieldGuidance } from "@ivy/shared";
import type { FormDetectedMessage } from "@ivy/shared/messages";

// Use Vite env vars if set (production build), otherwise localhost for dev
const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  return headers;
}

export default defineBackground(() => {
  // ── Side Panel Setup ──

  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // ── Content Script Injection ──
  // Inject on-demand instead of on every page load to avoid bot detection

  async function ensureContentScript(tabId: number): Promise<boolean> {
    try {
      // Check if already injected by sending a ping
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "GET_PAGE_CONTENT",
        payload: {},
      });
      return !!response;
    } catch {
      // Not injected yet — inject now
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content-scripts/content.js"],
        });
        // Small delay to let the script initialize
        await new Promise((r) => setTimeout(r, 100));
        return true;
      } catch {
        return false;
      }
    }
  }

  // ── Transform Cache (in-memory, service worker lifetime) ──

  const transformCache = new Map<
    string,
    { instructions: unknown[]; expiresAt: number }
  >();

  async function hashString(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  }

  // ── Form Guidance Cache ──

  const formGuidanceCache = new Map<
    string,
    { guidance: FormFieldGuidance[]; expiresAt: number }
  >();

  // ── On-Device AI (Chrome Prompt API / Gemini Nano) ──

  async function tryOnDeviceSimplify(text: string): Promise<string | null> {
    try {
      const ai = (globalThis as unknown as Record<string, unknown>).ai as
        | {
            languageModel?: {
              create: () => Promise<{
                prompt: (s: string) => Promise<string>;
              }>;
            };
          }
        | undefined;

      if (!ai?.languageModel) return null;

      const session = await ai.languageModel.create();
      return await session.prompt(
        `Simplify the following text to a 4th grade reading level. Keep the same meaning. Only output the simplified text, nothing else.\n\n${text}`
      );
    } catch {
      return null;
    }
  }

  // ── Cloud Transform ──

  async function requestCloudTransform(
    url: string,
    content: string,
    preferences: Record<string, unknown>,
    regions?: unknown[]
  ): Promise<{ instructions: TransformInstruction[]; processingMs: number } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(`${API_BASE_URL}/api/transform`, {
        method: "POST",
        headers: apiHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          url,
          content: content.slice(0, 50000),
          preferences,
          regions: regions?.slice(0, 30),
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Transform failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { instructions: TransformInstruction[]; cached: boolean; processingMs: number };
        error?: { code: string; message: string };
      };

      if (!result.success || !result.data) {
        console.warn("Transform returned no data:", result.error?.message ?? "unknown");
        return null;
      }
      return { instructions: result.data.instructions, processingMs: result.data.processingMs };
    } catch (err) {
      console.warn("Transform request failed:", err);
      return null;
    }
  }

  async function requestCloudExplain(
    text: string,
    context: string,
    readingLevel?: string
  ): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/explain`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ text, context, readingLevel }),
      });

      if (!response.ok) return null;

      const result = (await response.json()) as {
        success: boolean;
        data?: { answer: string };
      };

      return result.data?.answer ?? null;
    } catch {
      return null;
    }
  }

  // ── Behavioral Events ──

  async function trackEvent(
    eventType: string,
    context: Record<string, unknown>
  ) {
    try {
      await fetch(`${API_BASE_URL}/api/events`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          userId: "anonymous", // TODO: Replace with Clerk user ID
          eventType,
          context,
        }),
      });
    } catch {
      // Non-critical, fire and forget
    }
  }

  // ── Get Active Tab ──

  async function getActiveTabId(): Promise<number | undefined> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  }

  // ── Message Router ──

  chrome.runtime.onMessage.addListener(
    (msg: unknown, sender, sendResponse) => {
      if (!isIvyMessage(msg)) return;

      // Only accept messages from our own extension (content scripts, sidebar, popup)
      // sender.id is the extension's own ID for internal messages
      if (sender.id !== chrome.runtime.id) return;

      const message = msg as IvyMessage;

      switch (message.type) {
        case "TRANSFORM_PAGE": {
          // sender.tab is undefined when message comes from sidebar/popup
          const tabIdPromise = sender.tab?.id
            ? Promise.resolve(sender.tab.id)
            : getActiveTabId();
          tabIdPromise.then((tabId) => handleTransformPage(tabId)).then(sendResponse);
          return true;
        }

        case "HIGHLIGHT_ASK": {
          const tabIdPromise = sender.tab?.id
            ? Promise.resolve(sender.tab.id)
            : getActiveTabId();
          tabIdPromise
            .then((tabId) =>
              handleHighlightAsk(
                message.payload.selectedText,
                message.payload.context,
                tabId,
                message.payload.selector,
                message.payload.url
              )
            )
            .then(sendResponse);
          return true;
        }

        case "EVALUATE_BENEFITS": {
          handleEvaluateBenefits(message.payload.profile).then(sendResponse);
          return true;
        }

        case "SCAN_FOR_FORMS": {
          const tabIdPromise = sender.tab?.id
            ? Promise.resolve(sender.tab.id)
            : getActiveTabId();
          tabIdPromise.then((tabId) => handleScanForForms(tabId)).then(sendResponse);
          return true;
        }

        case "SUBMIT_FEEDBACK": {
          handleSubmitFeedback(message.payload).then(sendResponse);
          return true;
        }

        case "PREFERENCES_UPDATED":
          broadcastToTabs(message);
          trackEvent("preference_changed", message.payload as unknown as Record<string, unknown>);
          break;

        case "TOGGLE_IVY":
          broadcastToTabs(message);
          break;
      }
    }
  );

  function broadcastToTabs(message: IvyMessage) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      }
    });
  }

  async function getPreferences(): Promise<Record<string, unknown>> {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
    const raw = stored[STORAGE_KEYS.PREFERENCES];
    if (!raw) return {};

    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed?.state?.preferences ?? parsed?.preferences ?? parsed;
    } catch {
      return {};
    }
  }

  async function handleTransformPage(tabId?: number) {
    if (!tabId) return;

    // Notify sidebar that transform started
    chrome.runtime.sendMessage({
      type: "TRANSFORM_STATUS",
      payload: { status: "transforming" },
    }).catch(() => {});

    // Inject content script if not already present
    const injected = await ensureContentScript(tabId);
    if (!injected) {
      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: { status: "error", message: "Cannot access this page" },
      }).catch(() => {});
      return;
    }

    const pageContent = await new Promise<
      PageContentMessage["payload"] | null
    >((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "GET_PAGE_CONTENT", payload: {} },
        (response) => {
          if (chrome.runtime.lastError || !response) resolve(null);
          else resolve(response.payload);
        }
      );
    });

    if (!pageContent) {
      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: { status: "error", message: "Could not read page content" },
      }).catch(() => {});
      return;
    }

    const preferences = await getPreferences();
    const prefHash = await hashString(JSON.stringify(preferences));
    const urlHash = await hashString(pageContent.url);
    const cacheKey = `${urlHash}::${prefHash}`;

    // Check local cache
    const cached = transformCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      chrome.tabs.sendMessage(tabId, {
        type: "TRANSFORM_RESULT",
        payload: {
          instructions: cached.instructions,
          cached: true,
          processingMs: 0,
        },
      });
      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: { status: "done", cached: true, processingMs: 0 },
      }).catch(() => {});
      return;
    }

    const startTime = Date.now();

    // Try on-device first for quick feedback
    const onDeviceResult = await tryOnDeviceSimplify(
      pageContent.content.slice(0, 3000)
    );

    if (onDeviceResult) {
      // Send quick on-device result while cloud processes
      chrome.tabs.sendMessage(tabId, {
        type: "TRANSFORM_RESULT",
        payload: {
          instructions: [
            {
              selector: "body > p:first-of-type",
              action: "replace",
              value: onDeviceResult,
            },
          ],
          cached: false,
          processingMs: Date.now() - startTime,
        },
      });
    }

    // Cloud transform for full page
    const cloudResult = await requestCloudTransform(
      pageContent.url,
      pageContent.content,
      preferences,
      pageContent.regions
    );

    const totalMs = Date.now() - startTime;

    if (cloudResult && cloudResult.instructions.length > 0) {
      transformCache.set(cacheKey, {
        instructions: cloudResult.instructions,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      chrome.tabs.sendMessage(tabId, {
        type: "TRANSFORM_RESULT",
        payload: {
          instructions: cloudResult.instructions,
          cached: false,
          processingMs: totalMs,
        },
      });

      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: { status: "done", cached: false, processingMs: totalMs },
      }).catch(() => {});

      trackEvent("transform_accepted", {
        url: pageContent.url,
        selectors: cloudResult.instructions.map((i) => i.selector),
        instructionCount: cloudResult.instructions.length,
        processingMs: totalMs,
      });
    } else {
      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: {
          status: onDeviceResult ? "done" : "error",
          message: onDeviceResult ? undefined : "No transformations generated",
          processingMs: totalMs,
        },
      }).catch(() => {});
    }
  }

  async function handleEvaluateBenefits(profile: {
    incomeBracket: string | null;
    state: string | null;
    householdSize: number | null;
    hasDisability: boolean | null;
    veteranStatus: boolean | null;
    ageBracket: string | null;
  }) {
    // Notify sidebar that evaluation started
    chrome.runtime.sendMessage({
      type: "BENEFITS_STATUS",
      payload: { status: "evaluating" },
    }).catch(() => {});

    try {
      const preferences = await getPreferences();
      const readingLevel = preferences.readingLevel as string | undefined;

      const response = await fetch(`${API_BASE_URL}/api/benefits/evaluate`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ profile, readingLevel }),
      });

      if (!response.ok) {
        chrome.runtime.sendMessage({
          type: "BENEFITS_STATUS",
          payload: { status: "error", message: "Benefits evaluation failed" },
        }).catch(() => {});
        return;
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { recommendations: unknown[]; processingMs: number };
      };

      if (result.success && result.data) {
        chrome.runtime.sendMessage({
          type: "BENEFITS_STATUS",
          payload: {
            status: "done",
            recommendations: result.data.recommendations,
            processingMs: result.data.processingMs,
          },
        }).catch(() => {});

        trackEvent("benefits_evaluated", {
          resultCount: result.data.recommendations.length,
          processingMs: result.data.processingMs,
        });
      } else {
        chrome.runtime.sendMessage({
          type: "BENEFITS_STATUS",
          payload: { status: "error", message: "No results returned" },
        }).catch(() => {});
      }
    } catch {
      chrome.runtime.sendMessage({
        type: "BENEFITS_STATUS",
        payload: { status: "error", message: "Could not connect to benefits service" },
      }).catch(() => {});
    }
  }

  async function handleScanForForms(tabId?: number) {
    if (!tabId) return;

    chrome.runtime.sendMessage({
      type: "FORM_GUIDANCE_STATUS",
      payload: { status: "scanning" },
    }).catch(() => {});

    const injected = await ensureContentScript(tabId);
    if (!injected) {
      chrome.runtime.sendMessage({
        type: "FORM_GUIDANCE_STATUS",
        payload: { status: "error", message: "Cannot access this page" },
      }).catch(() => {});
      return;
    }

    // Ask content script to detect forms
    const formData = await new Promise<FormDetectedMessage["payload"] | null>(
      (resolve) => {
        chrome.tabs.sendMessage(
          tabId,
          { type: "SCAN_FOR_FORMS", payload: {} },
          (response) => {
            if (chrome.runtime.lastError || !response) resolve(null);
            else resolve(response.payload);
          }
        );
      }
    );

    if (!formData || formData.fields.length === 0) {
      chrome.runtime.sendMessage({
        type: "FORM_GUIDANCE_STATUS",
        payload: { status: "done", guidance: [], fieldCount: 0 },
      }).catch(() => {});
      return;
    }

    // Check cache
    const urlHash = await hashString(formData.url);
    const cached = formGuidanceCache.get(urlHash);
    if (cached && cached.expiresAt > Date.now()) {
      chrome.tabs.sendMessage(tabId, {
        type: "FORM_GUIDANCE_RESULT",
        payload: { guidance: cached.guidance, cached: true, processingMs: 0 },
      });
      chrome.runtime.sendMessage({
        type: "FORM_GUIDANCE_STATUS",
        payload: { status: "done", guidance: cached.guidance, fieldCount: formData.fields.length, cached: true },
      }).catch(() => {});
      return;
    }

    chrome.runtime.sendMessage({
      type: "FORM_GUIDANCE_STATUS",
      payload: { status: "generating", fieldCount: formData.fields.length },
    }).catch(() => {});

    try {
      const preferences = await getPreferences();
      const readingLevel = preferences.readingLevel as string | undefined;

      const response = await fetch(`${API_BASE_URL}/api/form-guidance`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          url: formData.url,
          pageTitle: formData.title,
          fields: formData.fields,
          readingLevel,
        }),
      });

      if (!response.ok) {
        chrome.runtime.sendMessage({
          type: "FORM_GUIDANCE_STATUS",
          payload: { status: "error", message: "Form guidance request failed" },
        }).catch(() => {});
        return;
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { guidance: FormFieldGuidance[]; processingMs: number };
      };

      if (result.success && result.data) {
        // Cache for 7 days
        formGuidanceCache.set(urlHash, {
          guidance: result.data.guidance,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        // Send guidance to content script for inline help icons
        chrome.tabs.sendMessage(tabId, {
          type: "FORM_GUIDANCE_RESULT",
          payload: {
            guidance: result.data.guidance,
            cached: false,
            processingMs: result.data.processingMs,
          },
        });

        // Notify sidebar
        chrome.runtime.sendMessage({
          type: "FORM_GUIDANCE_STATUS",
          payload: {
            status: "done",
            guidance: result.data.guidance,
            fieldCount: formData.fields.length,
            processingMs: result.data.processingMs,
          },
        }).catch(() => {});

        trackEvent("form_guidance_used", {
          url: formData.url,
          selectors: formData.fields.map((f) => f.selector),
          fieldCount: formData.fields.length,
          guidanceCount: result.data.guidance.length,
          processingMs: result.data.processingMs,
        });
      } else {
        chrome.runtime.sendMessage({
          type: "FORM_GUIDANCE_STATUS",
          payload: { status: "error", message: "No guidance generated" },
        }).catch(() => {});
      }
    } catch {
      chrome.runtime.sendMessage({
        type: "FORM_GUIDANCE_STATUS",
        payload: { status: "error", message: "Could not connect to form guidance service" },
      }).catch(() => {});
    }
  }

  async function handleSubmitFeedback(payload: {
    url: string;
    selector: string;
    comment: string;
    selectedText?: string;
  }) {
    chrome.runtime.sendMessage({
      type: "FEEDBACK_STATUS",
      payload: { status: "submitting" },
    }).catch(() => {});

    try {
      // If no URL provided, get it from the active tab
      let url = payload.url;
      if (!url) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        url = tab?.url ?? "";
      }

      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          url,
          selector: payload.selector ?? "body",
          comment: payload.comment,
          selectedText: payload.selectedText,
        }),
      });

      if (!response.ok) {
        chrome.runtime.sendMessage({
          type: "FEEDBACK_STATUS",
          payload: { status: "error", message: "Failed to submit feedback" },
        }).catch(() => {});
        return;
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { id: string; category: string; confidence: number };
      };

      if (result.success && result.data) {
        chrome.runtime.sendMessage({
          type: "FEEDBACK_STATUS",
          payload: {
            status: "done",
            id: result.data.id,
            category: result.data.category,
          },
        }).catch(() => {});

        trackEvent("feedback_submitted", {
          url,
          selector: payload.selector,
          category: result.data.category,
        });
      }
    } catch {
      chrome.runtime.sendMessage({
        type: "FEEDBACK_STATUS",
        payload: { status: "error", message: "Could not connect to feedback service" },
      }).catch(() => {});
    }
  }

  async function handleHighlightAsk(
    selectedText: string,
    context: string,
    tabId?: number,
    selector?: string,
    url?: string
  ) {
    if (!tabId) return;

    await ensureContentScript(tabId);

    // Try on-device first
    const onDeviceAnswer = await tryOnDeviceSimplify(
      `Explain this simply: "${selectedText}"`
    );

    if (onDeviceAnswer) {
      chrome.tabs.sendMessage(tabId, {
        type: "HIGHLIGHT_ANSWER",
        payload: { answer: onDeviceAnswer },
      });
      trackEvent("highlight_ask", { url, selector, text: selectedText.slice(0, 100), source: "on-device" });
      return;
    }

    // Cloud explain
    const preferences = await getPreferences();
    const readingLevel = preferences.readingLevel as string | undefined;

    const answer = await requestCloudExplain(selectedText, context, readingLevel);

    if (answer) {
      chrome.tabs.sendMessage(tabId, {
        type: "HIGHLIGHT_ANSWER",
        payload: { answer },
      });
      trackEvent("highlight_ask", { url, selector, text: selectedText.slice(0, 100), source: "cloud" });
    } else {
      chrome.tabs.sendMessage(tabId, {
        type: "ERROR",
        payload: {
          code: "EXPLAIN_FAILED",
          message: "Could not explain the selected text. Make sure the API and AI services are running.",
          source: "service-worker",
        },
      });
    }
  }
});
