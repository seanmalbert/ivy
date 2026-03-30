import { useFormGuidanceStore } from "../lib/store";

export function FormGuidancePanel() {
  const { status, guidance, detectedFieldCount, processingMs, error, reset } =
    useFormGuidanceStore();

  if (status === "idle") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-violet-50 p-4">
          <h3 className="text-sm font-medium text-violet-900">Form Help</h3>
          <p className="mt-1 text-sm text-violet-700 leading-relaxed">
            aiKea can scan this page for forms and explain each field in plain
            language. Help icons will appear next to form fields on the page.
          </p>
        </div>
        <button
          onClick={() => {
            chrome.runtime.sendMessage({
              type: "SCAN_FOR_FORMS",
              payload: {},
            });
          }}
          className="w-full py-2 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          Help with this form
        </button>
      </div>
    );
  }

  if (status === "scanning") {
    return (
      <div className="flex items-center gap-3 p-4">
        <span className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Scanning for form fields...</span>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex items-center gap-3 p-4">
        <span className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-600">
          Generating help for {detectedFieldCount} field
          {detectedFieldCount !== 1 ? "s" : ""}...
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          onClick={reset}
          className="text-sm text-violet-600 hover:text-violet-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // status === "done"
  if (guidance.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-sm text-yellow-700">
            No forms detected on this page. Navigate to a page with a form and
            try again.
          </p>
        </div>
        <button
          onClick={reset}
          className="text-sm text-violet-600 hover:text-violet-800 underline"
        >
          Scan again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {guidance.length} field{guidance.length !== 1 ? "s" : ""} explained
          {processingMs ? ` in ${processingMs}ms` : ""}
        </p>
        <button
          onClick={reset}
          className="text-xs text-violet-600 hover:text-violet-800 underline"
        >
          Rescan
        </button>
      </div>

      {guidance.map((field, i) => (
        <div
          key={field.selector + i}
          className="rounded-xl border border-gray-200 p-3 space-y-1"
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">{field.label}</h4>
            {field.required && (
              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-semibold rounded-full">
                Required
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {field.explanation}
          </p>
          {field.example && (
            <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-2 py-1 inline-block">
              e.g. {field.example}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
