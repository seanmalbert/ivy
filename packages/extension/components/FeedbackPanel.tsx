import { useState, useEffect, useRef } from "react";

type FeedbackStatus = "idle" | "submitting" | "done" | "error";

const CATEGORY_LABELS: Record<string, string> = {
  "confusing-language": "Confusing Language",
  "missing-info": "Missing Information",
  "broken-feature": "Broken Feature",
  accessibility: "Accessibility Issue",
  navigation: "Navigation Problem",
  positive: "Positive Feedback",
  other: "General Feedback",
};

export function FeedbackPanel() {
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef({ setStatus, setCategory, setError });
  statusRef.current = { setStatus, setCategory, setError };

  // Listen for FEEDBACK_STATUS from service worker
  useEffect(() => {
    const listener = (msg: unknown) => {
      const m = msg as { type?: string; payload?: Record<string, unknown> };
      if (m.type === "FEEDBACK_STATUS" && m.payload) {
        switch (m.payload.status) {
          case "submitting":
            statusRef.current.setStatus("submitting");
            break;
          case "done":
            statusRef.current.setStatus("done");
            statusRef.current.setCategory(
              (m.payload.category as string) ?? null
            );
            break;
          case "error":
            statusRef.current.setStatus("error");
            statusRef.current.setError(
              (m.payload.message as string) ?? "Failed to submit"
            );
            break;
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  function handleSubmit() {
    if (!comment.trim()) return;

    setStatus("submitting");
    chrome.runtime.sendMessage({
      type: "SUBMIT_FEEDBACK",
      payload: {
        url: "", // background.ts will fill from active tab
        selector: "body",
        comment: comment.trim(),
      },
    });
  }

  if (status === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm font-medium text-green-800">
            Thanks for your feedback!
          </p>
          {category && (
            <p className="mt-2 text-xs text-green-600">
              Categorized as:{" "}
              <span className="font-medium">
                {CATEGORY_LABELS[category] ?? category}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setStatus("idle");
            setComment("");
            setCategory(null);
          }}
          className="w-full py-2 px-4 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-violet-50 p-4">
        <h3 className="text-sm font-medium text-violet-900">Share Feedback</h3>
        <p className="mt-1 text-sm text-violet-700 leading-relaxed">
          Tell us about your experience on this page. Your feedback helps
          improve websites for everyone.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What was confusing or hard to use on this page?"
          maxLength={500}
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {comment.length}/500
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!comment.trim() || status === "submitting"}
        className="w-full py-2 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {status === "submitting" ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting...
          </>
        ) : (
          "Send Feedback"
        )}
      </button>

      <p className="text-xs text-gray-400 text-center leading-relaxed">
        You can also highlight text on the page and click "Reply" on the
        explanation to leave feedback about a specific section.
      </p>
    </div>
  );
}
