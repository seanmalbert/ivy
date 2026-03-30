import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@ivy/shared";

export default function App() {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEYS.PREFERENCES, (result) => {
      if (result[STORAGE_KEYS.PREFERENCES]) {
        try {
          const parsed = JSON.parse(result[STORAGE_KEYS.PREFERENCES]);
          setIsEnabled(parsed?.state?.isEnabled ?? true);
        } catch {
          // Use default
        }
      }
    });
  }, []);

  function toggleEnabled() {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.runtime.sendMessage({
      type: "TOGGLE_IVY",
      payload: { enabled: newState },
    });
  }

  function openSidePanel() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    window.close();
  }

  return (
    <div className="w-64 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">aiKea</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">aiKea</h1>
          <p className="text-xs text-gray-500">Personal Web Assistant</p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={toggleEnabled}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            isEnabled
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          {isEnabled ? "aiKea is On" : "aiKea is Off"}
        </button>

        <button
          onClick={openSidePanel}
          className="w-full py-2 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Open Sidebar
        </button>
      </div>
    </div>
  );
}
