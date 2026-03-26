import { Link } from "react-router";
import type { PageInsights } from "@ivy/shared/dashboard";

const EVENT_ICONS: Record<string, string> = {
  simplified: "Simplified",
  asked: "Questions",
  "form-help": "Form Help",
  comment: "Comments",
};

export function PageList({
  domain,
  pages,
}: {
  domain: string;
  pages: PageInsights[];
}) {
  if (pages.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No page interactions recorded yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {pages.map((page) => {
        // Summarize event types
        const typeCounts = new Map<string, number>();
        for (const insight of page.insights) {
          typeCounts.set(
            insight.eventType,
            (typeCounts.get(insight.eventType) ?? 0) + insight.count
          );
        }

        return (
          <Link
            key={page.urlPath}
            to={`/${encodeURIComponent(domain)}/page?path=${encodeURIComponent(page.urlPath)}`}
            className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-violet-700">
                {page.urlPath}
              </p>
              <div className="flex gap-3 mt-1">
                {Array.from(typeCounts.entries()).map(([type, count]) => (
                  <span key={type} className="text-xs text-gray-400">
                    {count} {EVENT_ICONS[type] ?? type}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 ml-4 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">
                {page.totalInteractions}
              </span>
              <span className="text-gray-300 group-hover:text-violet-400">
                &rarr;
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
