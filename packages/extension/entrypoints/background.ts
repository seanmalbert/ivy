import { isIvyMessage } from "@ivy/shared/messages";
import type { IvyMessage, PageContentMessage } from "@ivy/shared/messages";
import { API_BASE_URL, STORAGE_KEYS } from "@ivy/shared";
import type { TransformResponse } from "@ivy/shared";

export default defineBackground(() => {
  // ── Side Panel Setup ──

  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // ── Transform Cache (in-memory, service worker lifetime) ──

  const transformCache = new Map<
    string,
    { instructions: unknown[]; expiresAt: number }
  >();

  function getCacheKey(url: string, prefHash: string): string {
    return `${url}::${prefHash}`;
  }

  async function hashPreferences(
    prefs: Record<string, unknown>
  ): Promise<string> {
    const data = new TextEncoder().encode(JSON.stringify(prefs));
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  }

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
    preferences: Record<string, unknown>
  ): Promise<TransformResponse | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          content: content.slice(0, 50000),
          preferences,
        }),
      });

      if (!response.ok) return null;
      return (await response.json()) as TransformResponse;
    } catch {
      return null;
    }
  }

  // ── Message Router ──

  chrome.runtime.onMessage.addListener(
    (msg: unknown, sender, sendResponse) => {
      if (!isIvyMessage(msg)) return;

      const message = msg as IvyMessage;

      switch (message.type) {
        case "TRANSFORM_PAGE":
          handleTransformPage(sender.tab?.id).then(sendResponse);
          return true;

        case "HIGHLIGHT_ASK":
          handleHighlightAsk(
            message.payload.selectedText,
            message.payload.context,
            sender.tab?.id
          ).then(sendResponse);
          return true;

        case "PREFERENCES_UPDATED":
          broadcastToTabs(message);
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

  async function handleTransformPage(tabId?: number) {
    if (!tabId) return;

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

    if (!pageContent) return;

    const stored = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
    let preferences: Record<string, unknown> = {};
    if (stored[STORAGE_KEYS.PREFERENCES]) {
      try {
        const parsed = JSON.parse(stored[STORAGE_KEYS.PREFERENCES]);
        preferences = parsed?.state?.preferences ?? {};
      } catch {
        // Use defaults
      }
    }

    const prefHash = await hashPreferences(preferences);
    const cacheKey = getCacheKey(pageContent.url, prefHash);

    // Check cache
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
      return;
    }

    const startTime = Date.now();

    // Try on-device simplification first
    await tryOnDeviceSimplify(pageContent.content.slice(0, 3000));

    // Cloud transform for full page
    const cloudResult = await requestCloudTransform(
      pageContent.url,
      pageContent.content,
      preferences
    );

    if (cloudResult) {
      transformCache.set(cacheKey, {
        instructions: cloudResult.instructions,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      chrome.tabs.sendMessage(tabId, {
        type: "TRANSFORM_RESULT",
        payload: {
          instructions: cloudResult.instructions,
          cached: false,
          processingMs: Date.now() - startTime,
        },
      });
    }
  }

  async function handleHighlightAsk(
    selectedText: string,
    context: string,
    tabId?: number
  ) {
    if (!tabId) return;

    // Try on-device first
    const onDeviceAnswer = await tryOnDeviceSimplify(
      `Explain this simply: "${selectedText}"`
    );

    if (onDeviceAnswer) {
      chrome.tabs.sendMessage(tabId, {
        type: "HIGHLIGHT_ANSWER",
        payload: { answer: onDeviceAnswer },
      });
      return;
    }

    // Fall back to cloud
    try {
      const response = await fetch(`${API_BASE_URL}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, context }),
      });

      if (response.ok) {
        const data = (await response.json()) as { answer: string };
        chrome.tabs.sendMessage(tabId, {
          type: "HIGHLIGHT_ANSWER",
          payload: { answer: data.answer },
        });
      }
    } catch {
      chrome.tabs.sendMessage(tabId, {
        type: "ERROR",
        payload: {
          code: "EXPLAIN_FAILED",
          message:
            "Could not explain the selected text. Please try again.",
          source: "service-worker",
        },
      });
    }
  }
});
