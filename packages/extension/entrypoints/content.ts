import { isIvyMessage } from "@ivy/shared/messages";
import type {
  TransformResultMessage,
  HighlightAnswerMessage,
  FormGuidanceResultMessage,
  PageRegion,
} from "@ivy/shared/messages";
import type { ExtractedFormField, FormFieldGuidance } from "@ivy/shared";
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
        const cur: Element = current;
        const tag = cur.tagName.toLowerCase();
        const parent: Element | null = cur.parentElement;
        if (!parent) break;

        const siblings = Array.from(parent.children).filter(
          (s: Element) => s.tagName === cur.tagName
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
            position: relative;
          }
          .ivy-simplified:hover {
            background: rgba(124, 58, 237, 0.08);
          }
          .ivy-toggle-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
            opacity: 0;
            transition: opacity 0.2s;
          }
          .ivy-simplified:hover .ivy-toggle-bar {
            opacity: 1;
          }
          .ivy-toggle-bar span {
            font-size: 10px;
            color: #7c3aed;
            font-family: system-ui, sans-serif;
          }
          .ivy-toggle-btn {
            font-size: 10px;
            color: #7c3aed;
            background: none;
            border: 1px solid #7c3aed;
            border-radius: 4px;
            padding: 1px 6px;
            cursor: pointer;
            font-family: system-ui, sans-serif;
          }
          .ivy-toggle-btn:hover {
            background: rgba(124, 58, 237, 0.1);
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
                const savedOriginal = el.innerHTML;
                // Safe DOM construction: parse AI HTML into safe list items only
                if (/<li[\s>]/i.test(inst.value) && (el.tagName === "UL" || el.tagName === "OL")) {
                  const tempDoc = new DOMParser().parseFromString(
                    `<${el.tagName.toLowerCase()}>${inst.value}</${el.tagName.toLowerCase()}>`,
                    "text/html"
                  );
                  const listEl = tempDoc.querySelector(el.tagName.toLowerCase());
                  if (listEl) {
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

                // Add toggle bar to switch between simplified and original
                const simplifiedHTML = el.innerHTML;
                const bar = document.createElement("div");
                bar.className = "ivy-toggle-bar";
                const label = document.createElement("span");
                label.textContent = "Simplified by Ivy";
                const btn = document.createElement("button");
                btn.className = "ivy-toggle-btn";
                btn.textContent = "Show original";
                let showingOriginal = false;
                btn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  showingOriginal = !showingOriginal;
                  if (showingOriginal) {
                    // Remove toggle bar before restoring, then re-add
                    bar.remove();
                    el.innerHTML = savedOriginal;
                    el.appendChild(bar);
                    btn.textContent = "Show simplified";
                  } else {
                    bar.remove();
                    el.innerHTML = simplifiedHTML;
                    el.appendChild(bar);
                    btn.textContent = "Show original";
                  }
                });
                bar.appendChild(label);
                bar.appendChild(btn);
                el.appendChild(bar);

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

    // ── Form Detection ──

    function getFieldSelector(el: HTMLElement): string {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const name = el.getAttribute("name");
      if (name) {
        const tag = el.tagName.toLowerCase();
        const matches = document.querySelectorAll(`${tag}[name="${CSS.escape(name)}"]`);
        if (matches.length === 1) return `${tag}[name="${CSS.escape(name)}"]`;
      }
      return getUniqueSelector(el);
    }

    function extractFieldLabel(el: HTMLElement): string {
      // 1. Explicit <label for="...">
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
      // 2. aria-label
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
      // 3. aria-labelledby
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const refEl = document.getElementById(labelledBy);
        if (refEl?.textContent?.trim()) return refEl.textContent.trim();
      }
      // 4. Wrapping <label>
      const parentLabel = el.closest("label");
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("input,select,textarea").forEach((c) => c.remove());
        if (clone.textContent?.trim()) return clone.textContent.trim();
      }
      // 5. Placeholder
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) return placeholder;
      // 6. Name attribute as last resort
      const name = el.getAttribute("name");
      if (name) return name.replace(/[_-]/g, " ");
      return "";
    }

    function isFieldVisible(el: HTMLElement): boolean {
      if (el.offsetParent === null && el.style.position !== "fixed") return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }

    function detectForms(): ExtractedFormField[] {
      const fields: ExtractedFormField[] = [];
      const inputs = document.querySelectorAll<HTMLElement>(
        "input, select, textarea"
      );

      for (const el of inputs) {
        const inputType = (el.getAttribute("type") ?? (el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : "text")).toLowerCase();

        // Skip hidden, submit, button, and image inputs
        if (["hidden", "submit", "button", "image", "reset"].includes(inputType)) continue;
        if (!isFieldVisible(el)) continue;

        const label = extractFieldLabel(el);

        let options: string[] | undefined;
        if (el.tagName === "SELECT") {
          options = Array.from((el as HTMLSelectElement).options)
            .filter((o) => o.value && !o.disabled)
            .map((o) => o.textContent?.trim() ?? o.value)
            .slice(0, 20);
        }

        fields.push({
          selector: getFieldSelector(el),
          tagName: el.tagName.toLowerCase(),
          inputType,
          label,
          name: el.getAttribute("name") ?? "",
          placeholder: el.getAttribute("placeholder") ?? "",
          required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
          options,
        });
      }

      return fields;
    }

    // ── Form Guidance Display ──

    function applyFormGuidance(guidance: FormFieldGuidance[]) {
      // Inject form help styles
      if (!document.getElementById("ivy-form-help-styles")) {
        const style = document.createElement("style");
        style.id = "ivy-form-help-styles";
        style.textContent = `
          .ivy-form-field-wrapper {
            position: relative;
            display: inline-block;
          }
          .ivy-form-help-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #7c3aed;
            color: white;
            font-size: 11px;
            font-weight: bold;
            font-family: system-ui, sans-serif;
            cursor: help;
            margin-left: 4px;
            vertical-align: middle;
            user-select: none;
            flex-shrink: 0;
            position: relative;
          }
          .ivy-form-help-icon:hover {
            background: #6d28d9;
          }
          .ivy-form-help-tip {
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: normal;
            line-height: 1.4;
            max-width: 280px;
            min-width: 180px;
            white-space: normal;
            z-index: 2147483647;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-family: system-ui, sans-serif;
            text-align: left;
            pointer-events: none;
          }
          .ivy-form-help-tip::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #1f2937;
          }
        `;
        document.head.appendChild(style);
      }

      for (const field of guidance) {
        try {
          const el = document.querySelector(field.selector) as HTMLElement | null;
          if (!el) continue;

          // Don't add duplicate help icons
          if (el.nextElementSibling?.classList.contains("ivy-form-help-icon")) continue;

          const icon = document.createElement("span");
          icon.className = "ivy-form-help-icon";
          icon.textContent = "?";

          // Build tooltip on hover using real DOM elements
          let tipEl: HTMLElement | null = null;

          icon.addEventListener("mouseenter", () => {
            if (tipEl) return;
            tipEl = document.createElement("div");
            tipEl.className = "ivy-form-help-tip";
            tipEl.textContent = field.explanation;
            if (field.required) {
              tipEl.textContent += " (Required)";
            }
            if (field.example) {
              const ex = document.createElement("div");
              ex.style.cssText = "margin-top:4px;font-family:monospace;font-size:12px;opacity:0.7;";
              ex.textContent = `e.g. ${field.example}`;
              tipEl.appendChild(ex);
            }
            icon.appendChild(tipEl);
          });

          icon.addEventListener("mouseleave", () => {
            tipEl?.remove();
            tipEl = null;
          });

          // Insert icon after the field
          el.parentNode?.insertBefore(icon, el.nextSibling);
        } catch {
          // Selector may not match; skip gracefully
        }
      }
    }

    function removeFormGuidance() {
      document.querySelectorAll(".ivy-form-help-icon").forEach((el) => el.remove());
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

        case "SCAN_FOR_FORMS": {
          const formFields = detectForms();
          sendResponse({
            type: "FORM_DETECTED",
            payload: {
              url: window.location.href,
              title: document.title,
              fields: formFields,
            },
          });
          break;
        }

        case "FORM_GUIDANCE_RESULT":
          applyFormGuidance(
            (msg as FormGuidanceResultMessage).payload.guidance
          );
          break;

        case "UNDO_TRANSFORMS":
          undoTransforms();
          removeFormGuidance();
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
