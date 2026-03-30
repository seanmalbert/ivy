import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import type { PageInsights, SelectorInsight } from "@ivy/shared/dashboard";
import { fetchPageInsights } from "../api/client";
import { InsightsPanel } from "../components/InsightsPanel";
import { CategoryChart } from "../components/CategoryChart";
import { QuestionsPanel } from "../components/QuestionsPanel";
import { PagePreview } from "../components/PagePreview";
import type { PagePreviewHandle } from "../components/PagePreview";
import { MarkdownText } from "../components/MarkdownText";

export function PageDetail() {
  const { domain } = useParams<{ domain: string }>();
  const [searchParams] = useSearchParams();
  const path = searchParams.get("path") ?? "/";

  const previewRef = useRef<PagePreviewHandle>(null);
  const [data, setData] = useState<PageInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"preview" | "list">("preview");
  const [selectedInsight, setSelectedInsight] = useState<SelectorInsight | null>(null);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    fetchPageInsights(domain, path)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [domain, path]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const fullUrl = `https://${domain}${path}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to={`/${encodeURIComponent(domain!)}`}
            className="text-xs text-gray-400 hover:text-violet-600 mb-1 block"
          >
            &larr; {domain}
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{path}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalInteractions} interaction
            {data.totalInteractions !== 1 ? "s" : ""} on this page
          </p>
        </div>

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setView("preview")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Page Preview
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            List View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: preview or list */}
        <div className="lg:col-span-2 space-y-6">
          {view === "preview" ? (
            <div className="relative">
              <PagePreview
                ref={previewRef}
                url={fullUrl}
                insights={data.insights}
                onSelectInsight={setSelectedInsight}
              />
              {selectedInsight && (
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] rounded-b-xl max-h-[50%] overflow-y-auto">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {selectedInsight.eventType === "asked" ? "Question" :
                           selectedInsight.eventType === "simplified" ? "Simplified" :
                           selectedInsight.eventType === "form-help" ? "Form Help" : "Comment"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {selectedInsight.count}x
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedInsight(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        &times; Close
                      </button>
                    </div>
                    <div className="space-y-3">
                      {selectedInsight.samples.map((sample, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                            {sample}
                          </div>
                          {selectedInsight.responses[i] && (
                            <div className="text-sm text-gray-600 bg-violet-50 border-l-2 border-violet-400 rounded-r-lg p-3 leading-relaxed ml-4">
                              <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide block mb-1">
                                Ivy's response
                              </span>
                              <MarkdownText text={selectedInsight.responses[i]} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Element-Level Insights
              </h3>
              <InsightsPanel insights={data.insights} />
            </div>
          )}
        </div>

        {/* Right column: stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Feedback Categories
            </h3>
            <CategoryChart distribution={data.categoryDistribution} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Questions on This Page
            </h3>
            <QuestionsPanel
              questions={data.topQuestions}
              onSelectSelector={(selector, questionText) => {
                // Switch to preview view and scroll to the element
                setView("preview");
                previewRef.current?.scrollToSelector(selector, questionText);
                // Find and select the matching insight
                const match = data.insights.find(
                  (i) => i.selector === selector && i.eventType === "asked"
                ) ?? data.insights.find((i) => i.selector === selector);
                if (match) setSelectedInsight(match);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
