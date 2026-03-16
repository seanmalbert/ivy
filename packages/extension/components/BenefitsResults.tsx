import type { BenefitRecommendation, EligibilityStatus } from "@ivy/shared";

interface BenefitsResultsProps {
  recommendations: BenefitRecommendation[];
  processingMs: number | null;
  onReset: () => void;
}

const STATUS_CONFIG: Record<EligibilityStatus, { label: string; bg: string; text: string }> = {
  likely: { label: "Likely eligible", bg: "bg-green-100", text: "text-green-700" },
  possible: { label: "Possibly eligible", bg: "bg-yellow-100", text: "text-yellow-700" },
  check: { label: "Worth checking", bg: "bg-blue-100", text: "text-blue-700" },
};

const CATEGORY_ICONS: Record<string, string> = {
  food: "🍎",
  housing: "🏠",
  healthcare: "🏥",
  income: "💰",
  education: "📚",
  childcare: "👶",
  disability: "♿",
  veteran: "⭐",
  senior: "👴",
  utility: "💡",
};

export function BenefitsResults({ recommendations, processingMs, onReset }: BenefitsResultsProps) {
  const likelyCount = recommendations.filter((r) => r.eligibility === "likely").length;
  const possibleCount = recommendations.filter((r) => r.eligibility === "possible").length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-xl bg-green-50 border border-green-200 p-3">
        <p className="text-sm font-medium text-green-800">
          Found {recommendations.length} benefit{recommendations.length !== 1 ? "s" : ""} for you
        </p>
        <p className="text-xs text-green-600 mt-1">
          {likelyCount > 0 && `${likelyCount} likely eligible`}
          {likelyCount > 0 && possibleCount > 0 && " · "}
          {possibleCount > 0 && `${possibleCount} possibly eligible`}
          {processingMs ? ` · ${(processingMs / 1000).toFixed(1)}s` : ""}
        </p>
      </div>

      {/* Results */}
      {recommendations.map((rec) => {
        const config = STATUS_CONFIG[rec.eligibility];
        const icon = CATEGORY_ICONS[rec.benefit.category] ?? "📋";

        return (
          <div key={rec.benefitId} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-gray-900">{rec.benefit.name}</h4>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{rec.benefit.agency}</p>
                <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{rec.explanation}</p>
                <a
                  href={rec.benefit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-violet-600 hover:text-violet-800 underline"
                  onClick={(e) => {
                    e.preventDefault();
                    chrome.tabs.create({ url: rec.benefit.url });
                  }}
                >
                  Learn more & apply
                </a>
              </div>
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Update my info
        </button>
      </div>
    </div>
  );
}
