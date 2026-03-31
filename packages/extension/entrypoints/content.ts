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
  matches: [
    "*://*.gov/*",
    "*://*.gov.sg/*",
    "*://*.gov.uk/*",
    "*://*.gov.au/*",
    "*://*.gc.ca/*",
  ],
  runAt: "document_idle",

  main() {
    let ivyEnabled = true;
    let floatingButton: HTMLElement | null = null;

    // ── Page Content Extraction ──

    function getUniqueSelector(el: Element): string {
      // Use ID if available
      if (el.id) return `#${CSS.escape(el.id)}`;

      // Build a path, but stop at the nearest ancestor with an ID
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body && current !== document.documentElement) {
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

        // If parent has an ID, anchor there and stop
        if (parent.id && parent !== document.body) {
          parts.unshift(`#${CSS.escape(parent.id)}`);
          break;
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

    // Track the last highlight context for the Reply feature
    let lastHighlightSelector = "";
    let lastHighlightText = "";

    function showFloatingButton(x: number, y: number, selectedText: string) {
      removeFloatingButton();

      // Capture the selection context NOW, before the user clicks and the selection changes
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const ancestor = range?.commonAncestorContainer;
      // Get the element (commonAncestorContainer may be a text node)
      let contextEl: Element | null = ancestor instanceof Element ? ancestor : ancestor?.parentElement ?? null;
      // Walk up to the nearest block-level element for a more stable selector
      const inlineElements = new Set(["SPAN", "A", "EM", "STRONG", "B", "I", "U", "CODE", "MARK", "SMALL", "SUB", "SUP", "ABBR"]);
      while (contextEl && inlineElements.has(contextEl.tagName) && contextEl.parentElement) {
        contextEl = contextEl.parentElement;
      }
      const capturedSelector = contextEl ? getUniqueSelector(contextEl) : "";
      const capturedContext = contextEl?.textContent?.slice(0, 500) ?? "";

      // Save for Reply feature immediately
      lastHighlightSelector = capturedSelector;
      lastHighlightText = selectedText;

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
        // Show loading state
        floatingButton!.textContent = "Thinking...";
        floatingButton!.style.opacity = "0.7";
        floatingButton!.style.pointerEvents = "none";

        chrome.runtime.sendMessage({
          type: "HIGHLIGHT_ASK",
          payload: {
            selectedText,
            context: capturedContext,
            selector: capturedSelector,
            url: window.location.href,
          },
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
      const existing = document.getElementById("ivy-answer-overlay");
      if (existing) existing.remove();

      // Capture context at dialog creation time (selection may change later)
      const replySelector = lastHighlightSelector;
      const replySelectedText = lastHighlightText;

      // Backdrop
      const overlay = document.createElement("div");
      overlay.id = "ivy-answer-overlay";
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.4);
        z-index:2147483646; display:flex; align-items:center; justify-content:center;
        font-family:system-ui,sans-serif;
      `;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });

      // Dialog
      const dialog = document.createElement("div");
      dialog.style.cssText = `
        background:white; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.2);
        width:420px; max-width:90vw; max-height:80vh; overflow-y:auto;
        padding:24px; font-size:14px; line-height:1.6; color:#1f2937;
      `;

      // Header
      const header = document.createElement("div");
      header.style.cssText = "display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;";
      const title = document.createElement("div");
      title.style.cssText = "display:flex; align-items:center; gap:8px;";
      const badge = document.createElement("span");
      badge.style.cssText = "background:#7c3aed; color:white; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:6px;";
      badge.textContent = "Ivy";
      title.appendChild(badge);
      const titleText = document.createElement("span");
      titleText.style.cssText = "font-size:13px; font-weight:600; color:#374151;";
      titleText.textContent = "Explanation";
      title.appendChild(titleText);
      header.appendChild(title);

      const closeX = document.createElement("button");
      closeX.textContent = "\u00d7";
      closeX.style.cssText = "background:none; border:none; font-size:20px; color:#9ca3af; cursor:pointer; padding:0 4px; line-height:1;";
      closeX.addEventListener("click", () => overlay.remove());
      header.appendChild(closeX);
      dialog.appendChild(header);

      // Highlighted text quote
      if (replySelectedText) {
        const quote = document.createElement("div");
        quote.style.cssText = `
          background:#f9fafb; border-left:3px solid #7c3aed; padding:10px 14px;
          border-radius:0 8px 8px 0; margin-bottom:16px; font-size:13px;
          color:#6b7280; font-style:italic;
        `;
        quote.textContent = replySelectedText.length > 200
          ? replySelectedText.slice(0, 200) + "..."
          : replySelectedText;
        dialog.appendChild(quote);
      }

      // Answer -- render with basic markdown-like formatting (safe, no innerHTML from AI)
      const answerEl = document.createElement("div");
      answerEl.style.cssText = "margin-bottom:20px; color:#1f2937;";

      const lines = answer.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Markdown headers
        const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const heading = document.createElement(level === 1 ? "h3" : level === 2 ? "h4" : "h5");
          heading.textContent = headerMatch[2];
          const sizes: Record<number, string> = { 1: "15px", 2: "14px", 3: "13px" };
          heading.style.cssText = `font-size:${sizes[level]}; font-weight:600; color:#111827; margin:12px 0 6px 0;`;
          answerEl.appendChild(heading);
          continue;
        }

        // Bullet points
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const li = document.createElement("div");
          li.style.cssText = "padding-left:16px; position:relative; margin:4px 0;";
          const bullet = document.createElement("span");
          bullet.style.cssText = "position:absolute; left:4px; color:#7c3aed;";
          bullet.textContent = "\u2022";
          li.appendChild(bullet);
          const text = document.createElement("span");
          text.textContent = trimmed.slice(2);
          li.appendChild(text);
          answerEl.appendChild(li);
          continue;
        }

        // Regular paragraph
        const p = document.createElement("p");
        p.style.cssText = "margin:6px 0;";
        // Handle inline bold **text**
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        for (const part of parts) {
          if (part.startsWith("**") && part.endsWith("**")) {
            const bold = document.createElement("strong");
            bold.textContent = part.slice(2, -2);
            p.appendChild(bold);
          } else {
            p.appendChild(document.createTextNode(part));
          }
        }
        answerEl.appendChild(p);
      }

      dialog.appendChild(answerEl);

      // Button row
      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex; gap:8px; justify-content:flex-end;";

      const replyBtn = document.createElement("button");
      replyBtn.textContent = "Leave site feedback";
      replyBtn.style.cssText = `
        background:white; border:1px solid #e5e7eb; color:#7c3aed; border-radius:8px;
        padding:8px 16px; cursor:pointer; font-size:13px; font-weight:500;
        font-family:system-ui,sans-serif;
      `;
      replyBtn.addEventListener("mouseenter", () => { replyBtn.style.background = "#f5f3ff"; });
      replyBtn.addEventListener("mouseleave", () => { replyBtn.style.background = "white"; });
      replyBtn.addEventListener("click", () => {
        btnRow.remove();

        const inputSection = document.createElement("div");
        inputSection.style.cssText = "border-top:1px solid #e5e7eb; padding-top:16px;";

        const inputLabel = document.createElement("div");
        inputLabel.style.cssText = "font-size:13px; font-weight:500; color:#374151; margin-bottom:4px;";
        inputLabel.textContent = "Feedback about this page";
        inputSection.appendChild(inputLabel);

        const inputHint = document.createElement("div");
        inputHint.style.cssText = "font-size:12px; color:#9ca3af; margin-bottom:8px;";
        inputHint.textContent = "Your feedback is about the website content you highlighted, not Ivy's explanation. This helps site owners improve their pages.";
        inputSection.appendChild(inputHint);

        const input = document.createElement("textarea");
        input.placeholder = "e.g. This section was hard to understand because...";
        input.style.cssText = `
          width:100%; min-height:72px; border:1px solid #e5e7eb; border-radius:8px;
          padding:10px; font-size:13px; font-family:system-ui,sans-serif;
          resize:vertical; box-sizing:border-box; outline:none;
        `;
        input.addEventListener("focus", () => { input.style.borderColor = "#7c3aed"; });
        input.addEventListener("blur", () => { input.style.borderColor = "#e5e7eb"; });
        inputSection.appendChild(input);

        const sendRow = document.createElement("div");
        sendRow.style.cssText = "display:flex; gap:8px; margin-top:10px; justify-content:flex-end;";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = `
          background:none; border:1px solid #e5e7eb; color:#6b7280; border-radius:8px;
          padding:8px 16px; cursor:pointer; font-size:13px; font-family:system-ui,sans-serif;
        `;
        cancelBtn.addEventListener("click", () => overlay.remove());

        const sendBtn = document.createElement("button");
        sendBtn.textContent = "Send Feedback";
        sendBtn.style.cssText = `
          background:#7c3aed; color:white; border:none; border-radius:8px;
          padding:8px 16px; cursor:pointer; font-size:13px; font-weight:500;
          font-family:system-ui,sans-serif;
        `;
        sendBtn.addEventListener("click", () => {
          const comment = input.value.trim();
          if (!comment) return;

          sendBtn.textContent = "Sending...";
          sendBtn.style.opacity = "0.7";
          sendBtn.style.pointerEvents = "none";

          chrome.runtime.sendMessage({
            type: "SUBMIT_FEEDBACK",
            payload: {
              url: window.location.href,
              selector: replySelector || "body",
              comment,
              selectedText: replySelectedText,
            },
          });

          // Show confirmation
          dialog.innerHTML = "";
          const confirmEl = document.createElement("div");
          confirmEl.style.cssText = "text-align:center; padding:32px 16px;";
          const checkmark = document.createElement("div");
          checkmark.style.cssText = "font-size:32px; margin-bottom:12px;";
          checkmark.textContent = "\u2713";
          confirmEl.appendChild(checkmark);
          const msg = document.createElement("div");
          msg.style.cssText = "font-size:15px; font-weight:500; color:#059669;";
          msg.textContent = "Thanks for your feedback!";
          confirmEl.appendChild(msg);
          const sub = document.createElement("div");
          sub.style.cssText = "font-size:13px; color:#6b7280; margin-top:4px;";
          sub.textContent = "This helps improve the site for everyone.";
          confirmEl.appendChild(sub);
          dialog.appendChild(confirmEl);
          setTimeout(() => overlay.remove(), 2500);
        });

        sendRow.appendChild(cancelBtn);
        sendRow.appendChild(sendBtn);
        inputSection.appendChild(sendRow);
        dialog.appendChild(inputSection);
        input.focus();
      });

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.style.cssText = `
        background:#f3f4f6; border:none; color:#374151; border-radius:8px;
        padding:8px 16px; cursor:pointer; font-size:13px;
        font-family:system-ui,sans-serif;
      `;
      closeBtn.addEventListener("click", () => overlay.remove());

      btnRow.appendChild(replyBtn);
      btnRow.appendChild(closeBtn);
      dialog.appendChild(btnRow);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
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
