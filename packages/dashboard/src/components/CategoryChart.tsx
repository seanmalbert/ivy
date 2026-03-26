const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  "confusing-language": { label: "Confusing Language", color: "#ef4444" },
  "missing-info": { label: "Missing Information", color: "#f97316" },
  "broken-feature": { label: "Broken Feature", color: "#dc2626" },
  accessibility: { label: "Accessibility", color: "#8b5cf6" },
  navigation: { label: "Navigation", color: "#3b82f6" },
  positive: { label: "Positive", color: "#22c55e" },
  other: { label: "Other", color: "#6b7280" },
};

export function CategoryChart({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No categorized feedback yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([category, count]) => {
        const info = CATEGORY_LABELS[category] ?? {
          label: category,
          color: "#6b7280",
        };
        const pct = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={category}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700">{info.label}</span>
              <span className="text-gray-400 text-xs">
                {count} ({Math.round(pct)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: info.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
