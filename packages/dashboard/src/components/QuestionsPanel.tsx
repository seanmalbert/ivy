export function QuestionsPanel({
  questions,
  onSelectSelector,
}: {
  questions: Array<{ question: string; selector: string; count: number }>;
  onSelectSelector?: (selector: string, questionText?: string) => void;
}) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No questions recorded yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelectSelector?.(q.selector, q.question)}
          className="w-full flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-left hover:bg-gray-100 transition-colors"
        >
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium mt-0.5">
            {q.count}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-gray-700 leading-relaxed">
              {q.question}
            </p>
            {q.selector && q.selector !== "body" && (
              <code className="text-[10px] text-gray-400 mt-1 block truncate">
                {q.selector}
              </code>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
