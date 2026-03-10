import { isIvyMessage } from "@ivy/shared/messages";
import type {
  TransformResultMessage,
  HighlightAnswerMessage,
  PageRegion,
} from "@ivy/shared/messages";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    let ivyEnabled = true;
    let floatingButton: HTMLElement | null = null;

    // ── Page Content Extraction ──

    function extractPageRegions(): PageRegion[] {
      const regions: PageRegion[] = [];
      const elements = document.querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,article,section,form,table,ul,ol"
      );

      elements.forEach((el, index) => {
        const text = el.textContent?.trim() ?? "";
        if (text.length < 10) return;

        const tag = el.tagName.toLowerCase();
        let type: PageRegion["type"] = "unknown";
        if (tag.startsWith("h")) type = "heading";
        else if (tag === "p" || tag === "article" || tag === "section")
          type = "paragraph";
        else if (tag === "form") type = "form";
        else if (tag === "table") type = "table";
        else if (tag === "ul" || tag === "ol") type = "list";

        regions.push({
          selector: `${tag}:nth-of-type(${index + 1})`,
          type,
          content: text.slice(0, 2000),
        });
      });

      return regions;
    }

    function getPageContent() {
      return {
        url: window.location.href,
        title: document.title,
        content: document.body.innerText.slice(0, 50000),
        regions: extractPageRegions(),
      };
    }

    // ── DOM Transformations ──

    function applyTransformInstructions(
      instructions: TransformResultMessage["payload"]["instructions"]
    ) {
      for (const inst of instructions) {
        try {
          const elements = document.querySelectorAll(inst.selector);
          elements.forEach((el) => {
            switch (inst.action) {
              case "replace":
                el.innerHTML = inst.value;
                break;
              case "wrap":
                el.innerHTML = inst.value;
                break;
              case "annotate": {
                const tooltip = document.createElement("span");
                tooltip.className = "ivy-tooltip";
                tooltip.setAttribute("data-ivy-tip", inst.value);
                tooltip.style.cssText =
                  "border-bottom:1px dashed #7c3aed;cursor:help;";
                el.parentNode?.replaceChild(tooltip, el);
                tooltip.appendChild(el);
                break;
              }
              case "style":
                (el as HTMLElement).style.cssText += inst.value;
                break;
              case "remove":
                el.remove();
                break;
            }
          });
        } catch {
          // Selector may not match; skip gracefully
        }
      }
    }

    // ── CSS Accessibility Adjustments ──

    function applyAccessibilityCSS(prefs: {
      fontScale?: number;
      highContrast?: boolean;
      reduceMotion?: boolean;
    }) {
      let styleEl = document.getElementById("ivy-accessibility");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "ivy-accessibility";
        document.head.appendChild(styleEl);
      }

      const rules: string[] = [];

      if (prefs.fontScale && prefs.fontScale !== 1.0) {
        rules.push(
          `html { font-size: ${prefs.fontScale * 100}% !important; }`
        );
      }

      if (prefs.highContrast) {
        rules.push(`
          body { color: #000 !important; background: #fff !important; }
          a { color: #1a0dab !important; }
          img { filter: contrast(1.2) !important; }
        `);
      }

      if (prefs.reduceMotion) {
        rules.push(`*, *::before, *::after {
          animation-duration: 0.001s !important;
          transition-duration: 0.001s !important;
        }`);
      }

      styleEl.textContent = rules.join("\n");
    }

    // ── Highlight-and-Ask ──

    function showFloatingButton(x: number, y: number, selectedText: string) {
      removeFloatingButton();

      floatingButton = document.createElement("div");
      floatingButton.id = "ivy-ask-button";
      floatingButton.textContent = "Ask Ivy";
      floatingButton.style.cssText = `
        position:fixed; left:${x}px; top:${y - 40}px;
        background:#7c3aed; color:white; padding:6px 12px;
        border-radius:8px; font-size:13px; font-family:system-ui,sans-serif;
        cursor:pointer; z-index:2147483647;
        box-shadow:0 2px 8px rgba(0,0,0,0.2); user-select:none;
      `;

      floatingButton.addEventListener("click", () => {
        const context =
          window.getSelection()?.anchorNode?.parentElement?.textContent?.slice(
            0,
            500
          ) ?? "";

        chrome.runtime.sendMessage({
          type: "HIGHLIGHT_ASK",
          payload: { selectedText, context },
        });
        removeFloatingButton();
      });

      document.body.appendChild(floatingButton);
    }

    function removeFloatingButton() {
      if (floatingButton) {
        floatingButton.remove();
        floatingButton = null;
      }
    }

    document.addEventListener("mouseup", () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (text.length > 3 && ivyEnabled) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          showFloatingButton(
            rect.left + rect.width / 2 - 30,
            rect.top,
            text
          );
        }
      } else {
        removeFloatingButton();
      }
    });

    document.addEventListener("mousedown", (e) => {
      if (floatingButton && !floatingButton.contains(e.target as Node)) {
        removeFloatingButton();
      }
    });

    // ── Message Handling ──

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!isIvyMessage(msg)) return;

      switch (msg.type) {
        case "GET_PAGE_CONTENT":
          sendResponse({ type: "PAGE_CONTENT", payload: getPageContent() });
          break;

        case "TRANSFORM_RESULT":
          applyTransformInstructions(msg.payload.instructions);
          break;

        case "HIGHLIGHT_ANSWER": {
          const answer = (msg as HighlightAnswerMessage).payload;
          showAnswerTooltip(answer.answer);
          break;
        }

        case "PREFERENCES_UPDATED":
          applyAccessibilityCSS(msg.payload);
          break;

        case "TOGGLE_IVY":
          ivyEnabled = msg.payload.enabled;
          if (!ivyEnabled) {
            const styleEl = document.getElementById("ivy-accessibility");
            if (styleEl) styleEl.textContent = "";
          }
          break;
      }
    });

    function showAnswerTooltip(answer: string) {
      const existing = document.getElementById("ivy-answer-tooltip");
      if (existing) existing.remove();

      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (!rect) return;

      const tooltip = document.createElement("div");
      tooltip.id = "ivy-answer-tooltip";
      tooltip.style.cssText = `
        position:fixed;
        left:${Math.min(rect.left, window.innerWidth - 340)}px;
        top:${rect.bottom + 8}px;
        background:white; border:1px solid #e5e7eb; border-radius:12px;
        z-index:2147483647; box-shadow:0 4px 16px rgba(0,0,0,0.12);
        max-width:320px; padding:12px; font-size:14px; line-height:1.5;
        font-family:system-ui,sans-serif;
      `;

      const text = document.createElement("div");
      text.textContent = answer;
      tooltip.appendChild(text);

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.style.cssText =
        "display:block;margin-top:8px;margin-left:auto;background:none;border:none;color:#7c3aed;cursor:pointer;font-size:12px;";
      closeBtn.addEventListener("click", () => tooltip.remove());
      tooltip.appendChild(closeBtn);

      document.body.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 30000);
    }

    // ── Initialize ──

    chrome.storage.local.get("ivy_preferences", (result) => {
      if (result.ivy_preferences) {
        try {
          const stored = JSON.parse(result.ivy_preferences);
          if (stored?.state?.preferences) {
            applyAccessibilityCSS(stored.state.preferences);
          }
        } catch {
          // Ignore parse errors
        }
      }
    });
  },
});
