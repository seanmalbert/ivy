import { useState } from "react";
import type { SelectorInsight } from "@ivy/shared/dashboard";
import { MarkdownText } from "./MarkdownText";

const EVENT_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  simplified: { label: "Simplified", bg: "bg-orange-100", text: "text-orange-700" },
  asked: { label: "Question", bg: "bg-blue-100", text: "text-blue-700" },
  "form-help": { label: "Form Help", bg: "bg-green-100", text: "text-green-700" },
  comment: { label: "Comment", bg: "bg-violet-100", text: "text-violet-700" },
};

function InsightRow({ insight }: { insight: SelectorInsight }) {
  const [expanded, setExpanded] = useState(false);
  const style = EVENT_STYLES[insight.eventType] ?? {
    label: insight.eventType,
    bg: "bg-gray-100",
    text: "text-gray-700",
  };

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span
          className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
        <code className="text-xs text-gray-500 truncate min-w-0 flex-1">
          {insight.selector}
        </code>
        <span className="shrink-0 text-sm font-medium text-gray-500">
          {insight.count}x
        </span>
        <span className="shrink-0 text-gray-300 text-xs">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {expanded && (insight.samples.length > 0 || insight.responses.length > 0) && (
        <div className="px-3 pb-3 space-y-3">
          {insight.samples.map((sample, i) => (
            <div key={i} className="space-y-1">
              <div className="text-sm text-gray-600 bg-gray-50 rounded p-2 leading-relaxed">
                "{sample}"
              </div>
              {insight.responses[i] && (
                <div className="text-sm text-gray-500 bg-violet-50 border-l-2 border-violet-300 rounded-r p-2 leading-relaxed ml-3">
                  <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide block mb-1">
                    aiKea's response
                  </span>
                  <MarkdownText text={insight.responses[i]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: SelectorInsight[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No element-level insights yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <InsightRow key={`${insight.selector}-${insight.eventType}-${i}`} insight={insight} />
      ))}
    </div>
  );
}
