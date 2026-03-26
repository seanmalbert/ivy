import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import type { DomainInsights } from "@ivy/shared/dashboard";
import { fetchDomainInsights } from "../api/client";
import { PageList } from "../components/PageList";
import { CategoryChart } from "../components/CategoryChart";
import { QuestionsPanel } from "../components/QuestionsPanel";

export function DomainOverview() {
  const { domain } = useParams<{ domain: string }>();
  const [data, setData] = useState<DomainInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    fetchDomainInsights(domain)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [domain]);

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
        <Link to="/" className="text-sm text-violet-600 underline mt-2 block">
          Back to domain picker
        </Link>
      </div>
    );
  }

  if (!data) return null;

  // Aggregate categories and questions across all pages
  const allCategories: Record<string, number> = {};
  const allQuestions: Array<{ question: string; selector: string; count: number }> = [];
  const seenQuestions = new Map<string, number>();

  for (const page of data.pages) {
    for (const [cat, count] of Object.entries(page.categoryDistribution)) {
      allCategories[cat] = (allCategories[cat] ?? 0) + count;
    }
    for (const q of page.topQuestions) {
      const existing = seenQuestions.get(q.question);
      if (existing !== undefined) {
        allQuestions[existing].count += q.count;
      } else {
        seenQuestions.set(q.question, allQuestions.length);
        allQuestions.push({ ...q });
      }
    }
  }
  allQuestions.sort((a, b) => b.count - a.count);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-violet-600 mb-1 block"
          >
            &larr; All domains
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{domain}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalInteractions} total interaction
            {data.totalInteractions !== 1 ? "s" : ""} across{" "}
            {data.pages.length} page{data.pages.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: page list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              User Page Insights
            </h3>
            <PageList domain={domain!} pages={data.pages} />
          </div>
        </div>

        {/* Right column: aggregated stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Feedback Categories
            </h3>
            <CategoryChart distribution={allCategories} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Commonly Asked Questions
            </h3>
            <QuestionsPanel questions={allQuestions.slice(0, 10)} />
          </div>
        </div>
      </div>
    </div>
  );
}
