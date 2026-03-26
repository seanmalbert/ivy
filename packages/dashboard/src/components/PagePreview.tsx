import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { SelectorInsight } from "@ivy/shared/dashboard";

export interface PagePreviewHandle {
  scrollToSelector: (selector: string, textHint?: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const EVENT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  simplified: { bg: "rgba(249,115,22,0.15)", border: "#f97316", label: "Simplified" },
  asked: { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", label: "Question" },
  "form-help": { bg: "rgba(34,197,94,0.15)", border: "#22c55e", label: "Form Help" },
  comment: { bg: "rgba(124,58,237,0.15)", border: "#7c3aed", label: "Comment" },
};

export const PagePreview = forwardRef<PagePreviewHandle, {
  url: string;
  insights: SelectorInsight[];
  onSelectInsight?: (insight: SelectorInsight) => void;
}>(function PagePreview({ url, insights, onSelectInsight }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const insightsRef = useRef(insights);
  insightsRef.current = insights;
  const onSelectRef = useRef(onSelectInsight);
  onSelectRef.current = onSelectInsight;

  useImperativeHandle(ref, () => ({
    scrollToSelector(selector: string, textHint?: string) {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        let el = doc.querySelector(selector) as HTMLElement | null;

        // Fallback: search by text content
        if (!el && textHint) {
          const searchText = textHint.slice(0, 80);
          const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
          let node: Text | null;
          while ((node = walker.nextNode() as Text | null)) {
            if (node.textContent && node.textContent.includes(searchText)) {
              el = node.parentElement;
              break;
            }
          }
        }

        if (!el) return;
        // Flash highlight
        const prev = el.style.outline;
        el.style.outline = "3px solid #3b82f6";
        el.style.outlineOffset = "2px";
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          el!.style.outline = prev;
          el!.style.outlineOffset = "";
        }, 2000);
      } catch {
        // ignore
      }
    },
  }));

  // Fetch proxied HTML
  useEffect(() => {
    setHtml(null);
    setLoaded(false);
    setError(false);

    const proxyUrl = `${API_BASE}/dashboard/proxy?url=${encodeURIComponent(url)}`;
    fetch(proxyUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then(setHtml)
      .catch(() => setError(true));
  }, [url]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Inject styles for highlighted elements
      const style = doc.createElement("style");
      style.textContent = `
        .ivy-highlighted {
          outline: 2px solid var(--ivy-color) !important;
          outline-offset: 1px;
          background: var(--ivy-bg) !important;
          position: relative !important;
          cursor: pointer !important;
          transition: outline-color 0.2s;
        }
        .ivy-highlighted:hover {
          outline-width: 3px;
        }
        .ivy-insight-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 20px;
          height: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          color: white;
          padding: 0 5px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          z-index: 10000;
          pointer-events: none;
        }
        .ivy-insight-label-bar {
          position: absolute;
          bottom: -20px;
          left: 0;
          font-size: 10px;
          font-family: system-ui, sans-serif;
          font-weight: 600;
          white-space: nowrap;
          padding: 2px 6px;
          border-radius: 4px;
          color: white;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
          z-index: 10000;
        }
        .ivy-highlighted:hover .ivy-insight-label-bar {
          opacity: 1;
        }
      `;
      doc.head.appendChild(style);

      // Collect body-level insights into a banner instead of overlaying them
      const bodyInsights: typeof insightsRef.current = [];

      for (const insight of insightsRef.current) {
        try {
          if (insight.selector === "body" || insight.selector === "html") {
            bodyInsights.push(insight);
            continue;
          }

          let el = doc.querySelector(insight.selector) as HTMLElement | null;

          // Fallback: if selector doesn't match, search by sample text content
          if (!el && insight.samples.length > 0) {
            const sampleText = insight.samples[0].slice(0, 80);
            if (sampleText) {
              const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
              let node: Text | null;
              while ((node = walker.nextNode() as Text | null)) {
                if (node.textContent && node.textContent.includes(sampleText)) {
                  el = node.parentElement;
                  break;
                }
              }
            }
          }
          if (!el) continue;

          const colors = EVENT_COLORS[insight.eventType] ?? EVENT_COLORS.comment;

          // Style the element directly -- stays aligned on resize
          el.classList.add("ivy-highlighted");
          el.style.setProperty("--ivy-color", colors.border);
          el.style.setProperty("--ivy-bg", colors.bg);

          // Ensure the element can hold absolutely positioned children
          const pos = getComputedStyle(el).position;
          if (pos === "static") {
            el.style.position = "relative";
          }

          // Count badge
          const badge = doc.createElement("div");
          badge.className = "ivy-insight-badge";
          badge.style.backgroundColor = colors.border;
          badge.textContent = String(insight.count);
          el.appendChild(badge);

          // Label on hover
          const label = doc.createElement("div");
          label.className = "ivy-insight-label-bar";
          label.style.backgroundColor = colors.border;
          label.textContent = `${colors.label} (${insight.count}x)`;
          el.appendChild(label);

          // Click to select
          const idx = insightsRef.current.indexOf(insight);
          el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectRef.current?.(insightsRef.current[idx]);
          });
        } catch {
          // Selector may not match
        }
      }

      // Render body-level insights as a fixed banner at the top of the page
      if (bodyInsights.length > 0) {
        const banner = doc.createElement("div");
        banner.style.cssText = `
          position: sticky; top: 0; left: 0; right: 0; z-index: 10001;
          background: #1f2937; color: white; padding: 8px 12px;
          font-family: system-ui, sans-serif; font-size: 12px;
          display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
        `;
        const label = doc.createElement("span");
        label.style.cssText = "font-weight: 600; opacity: 0.7;";
        label.textContent = "Page-level:";
        banner.appendChild(label);
        for (const bi of bodyInsights) {
          const colors = EVENT_COLORS[bi.eventType] ?? EVENT_COLORS.comment;
          const chip = doc.createElement("span");
          chip.style.cssText = `
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 8px; border-radius: 9999px; font-size: 11px;
            background: ${colors.border}; color: white; cursor: pointer;
          `;
          chip.textContent = `${colors.label} (${bi.count}x)`;
          const idx = insightsRef.current.indexOf(bi);
          chip.addEventListener("click", () => {
            onSelectRef.current?.(insightsRef.current[idx]);
          });
          banner.appendChild(chip);
        }
        doc.body.prepend(banner);
      }

      setLoaded(true);
    } catch {
      setError(true);
    }
  }, []);

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
      {html === null && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading page preview...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            Unable to load page preview. The site may block embedding.
          </p>
        </div>
      )}
      {html !== null && (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleLoad}
          onError={() => setError(true)}
          sandbox="allow-same-origin"
          className="w-full border-0"
          style={{ height: "600px" }}
          title="Page preview"
        />
      )}
      {loaded && (
        <div className="flex gap-4 px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs">
          {Object.entries(EVENT_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm border-2"
                style={{ borderColor: colors.border, backgroundColor: colors.bg }}
              />
              <span className="text-gray-500">{colors.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
