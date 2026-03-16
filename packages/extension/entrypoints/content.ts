import { isIvyMessage } from "@ivy/shared/messages";
import type {
  TransformResultMessage,
  HighlightAnswerMessage,
  PageRegion,
} from "@ivy/shared/messages";
import { STORAGE_KEYS } from "@ivy/shared";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    let ivyEnabled = true;
    let floatingButton: HTMLElement | null = null;

    // ── Page Content Extraction ──

    function getUniqueSelector(el: Element): string {
      // Use ID if available
      if (el.id) return `#${CSS.escape(el.id)}`;

      // Build a path using nth-child
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (!parent) break;

        const siblings = Array.from(parent.children).filter(
          (s) => s.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}:nth-of-type(${idx})`);
        } else {
          parts.unshift(tag);
        }
        current = parent;
      }
      return parts.join(" > ");
    }

    function extractPageRegions(): PageRegion[] {
      const regions: PageRegion[] = [];
      // Target main content areas, skip nav/header/footer
      const mainContent =
        document.querySelector("main, [role='main'], article, .content, #content") ??
        document.body;

      const elements = mainContent.querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,ul,ol,table"
      );

      elements.forEach((el) => {
        const text = el.textContent?.trim() ?? "";
        if (text.length < 20) return;
        // Skip elements nested inside another matched element (avoid duplicates)
        if (el.parentElement?.closest("ul,ol,table") && (el.tagName === "UL" || el.tagName === "OL")) return;

        const tag = el.tagName.toLowerCase();
        let type: PageRegion["type"] = "unknown";
        if (tag.startsWith("h")) type = "heading";
        else if (tag === "p") type = "paragraph";
        else if (tag === "table") type = "table";
        else if (tag === "ul" || tag === "ol") type = "list";

        regions.push({
          selector: getUniqueSelector(el),
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

    // Store original content for undo
    const originalContent = new Map<Element, string>();
    let transformedCount = 0;

    function applyTransformInstructions(
      instructions: TransformResultMessage["payload"]["instructions"]
    ) {
      transformedCount = 0;

      // Inject Ivy highlight styles if not present
      if (!document.getElementById("ivy-transform-styles")) {
        const style = document.createElement("style");
        style.id = "ivy-transform-styles";
        style.textContent = `
          .ivy-simplified {
            border-left: 3px solid #7c3aed;
            padding-left: 8px;
            background: rgba(124, 58, 237, 0.04);
            color: #1f2937 !important;
            transition: background 0.3s;
          }
          .ivy-simplified:hover {
            background: rgba(124, 58, 237, 0.08);
          }
          .ivy-simplified::after {
            content: "Simplified by Ivy";
            display: block;
            font-size: 10px;
            color: #7c3aed;
            margin-top: 4px;
            font-family: system-ui, sans-serif;
            opacity: 0;
            transition: opacity 0.2s;
          }
          .ivy-simplified:hover::after {
            opacity: 1;
          }
          .ivy-tooltip {
            border-bottom: 1px dashed #7c3aed;
            cursor: help;
            position: relative;
          }
          .ivy-tooltip:hover::after {
            content: attr(data-ivy-tip);
            position: absolute;
            bottom: 100%;
            left: 0;
            background: #1f2937;
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.4;
            max-width: 280px;
            white-space: normal;
            z-index: 2147483647;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-family: system-ui, sans-serif;
          }
        `;
        document.head.appendChild(style);
      }

      for (const inst of instructions) {
        try {
          const elements = document.querySelectorAll(inst.selector);
          elements.forEach((el) => {
            // Save original content for undo
            if (!originalContent.has(el)) {
              originalContent.set(el, el.innerHTML);
            }

            switch (inst.action) {
              case "replace": {
                // Safe DOM construction: parse AI HTML into safe list items only
                if (/<li[\s>]/i.test(inst.value) && (el.tagName === "UL" || el.tagName === "OL")) {
                  // For lists, safely construct <li> elements from AI output
                  const tempDoc = new DOMParser().parseFromString(
                    `<${el.tagName.toLowerCase()}>${inst.value}</${el.tagName.toLowerCase()}>`,
                    "text/html"
                  );
                  const listEl = tempDoc.querySelector(el.tagName.toLowerCase());
                  if (listEl) {
                    // Clear existing children and copy only safe <li> elements
                    while (el.firstChild) el.removeChild(el.firstChild);
                    for (const li of Array.from(listEl.querySelectorAll("li"))) {
                      const safeLi = document.createElement("li");
                      safeLi.textContent = li.textContent ?? "";
                      el.appendChild(safeLi);
                    }
                  }
                } else {
                  el.textContent = inst.value;
                }
                (el as HTMLElement).classList.add("ivy-simplified");
                transformedCount++;
                break;
              }
              case "annotate": {
                // Sanitize tooltip value — text only, no HTML
                const sanitizedTip = inst.value.replace(/[<>]/g, "");
                const tooltip = document.createElement("span");
                tooltip.className = "ivy-tooltip";
                tooltip.setAttribute("data-ivy-tip", sanitizedTip);
                el.parentNode?.replaceChild(tooltip, el);
                tooltip.appendChild(el);
                transformedCount++;
                break;
              }
              case "style": {
                // Only allow safe CSS properties, reject anything with url() or expression()
                const safeCSS = inst.value.replace(/url\s*\(|expression\s*\(/gi, "");
                (el as HTMLElement).style.cssText += safeCSS;
                break;
              }
              case "remove":
                (el as HTMLElement).style.display = "none";
                (el as HTMLElement).classList.add("ivy-simplified");
                transformedCount++;
                break;
            }
          });
        } catch {
          // Selector may not match; skip gracefully
        }
      }

      // Notify the sidebar how many sections were transformed
      chrome.runtime.sendMessage({
        type: "TRANSFORM_STATUS",
        payload: {
          status: "done",
          transformedCount,
          processingMs: 0,
        },
      }).catch(() => {});
    }

    function undoTransforms() {
      originalContent.forEach((html, el) => {
        el.innerHTML = html;
        (el as HTMLElement).classList.remove("ivy-simplified");
      });
      originalContent.clear();
      transformedCount = 0;
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
        const selContext =
          window.getSelection()?.anchorNode?.parentElement?.textContent?.slice(
            0,
            500
          ) ?? "";

        // Show loading state
        floatingButton!.textContent = "Thinking...";
        floatingButton!.style.opacity = "0.7";
        floatingButton!.style.pointerEvents = "none";

        chrome.runtime.sendMessage({
          type: "HIGHLIGHT_ASK",
          payload: { selectedText, context: selContext },
        });
      });

      document.body.appendChild(floatingButton);
    }

    function removeFloatingButton() {
      if (floatingButton) {
        floatingButton.remove();
        floatingButton = null;
      }
    }

    document.addEventListener("mouseup", (e) => {
      // Don't dismiss if clicking the Ask Ivy button
      if (floatingButton?.contains(e.target as Node)) return;

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
          removeFloatingButton();
          const answer = (msg as HighlightAnswerMessage).payload;
          showAnswerTooltip(answer.answer);
          break;
        }

        case "ERROR":
          removeFloatingButton();
          if (msg.payload.code === "EXPLAIN_FAILED") {
            showAnswerTooltip(msg.payload.message);
          }
          break;

        case "PREFERENCES_UPDATED":
          applyAccessibilityCSS(msg.payload);
          break;

        case "TOGGLE_IVY":
          ivyEnabled = msg.payload.enabled;
          if (!ivyEnabled) {
            const styleEl = document.getElementById("ivy-accessibility");
            if (styleEl) styleEl.textContent = "";
            undoTransforms();
          }
          break;

        case "UNDO_TRANSFORMS":
          undoTransforms();
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

    chrome.storage.local.get(STORAGE_KEYS.PREFERENCES, (result) => {
      if (result[STORAGE_KEYS.PREFERENCES]) {
        try {
          const stored = JSON.parse(result[STORAGE_KEYS.PREFERENCES]);
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
