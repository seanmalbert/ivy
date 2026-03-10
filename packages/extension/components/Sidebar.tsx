import * as Tabs from "@radix-ui/react-tabs";
import { usePreferencesStore, useTransformStore } from "../lib/store";
import { PreferenceChat } from "./PreferenceChat";
import { PreferencesPanel } from "./PreferencesPanel";

export function Sidebar() {
  const { isOnboarded, isEnabled, setEnabled } = usePreferencesStore();
  const { isTransforming, lastTransformMs } = useTransformStore();

  if (!isOnboarded) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Ivy</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900">Setup</h1>
        </header>
        <PreferenceChat />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Ivy</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900">Ivy</h1>
        </div>
        <div className="flex items-center gap-2">
          {isTransforming && (
            <span className="text-xs text-violet-600 animate-pulse">
              Transforming...
            </span>
          )}
          {lastTransformMs && !isTransforming && (
            <span className="text-xs text-gray-400">
              {lastTransformMs}ms
            </span>
          )}
          <button
            onClick={() => setEnabled(!isEnabled)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isEnabled
                ? "bg-violet-100 text-violet-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isEnabled ? "On" : "Off"}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs.Root defaultValue="home" className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex border-b border-gray-200 px-4">
          {["home", "benefits", "settings"].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className="px-3 py-2 text-sm text-gray-500 capitalize border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 transition-colors"
            >
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="home" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="rounded-xl bg-violet-50 p-4">
              <h3 className="text-sm font-medium text-violet-900">
                How Ivy works
              </h3>
              <p className="mt-1 text-sm text-violet-700 leading-relaxed">
                Visit any web page and Ivy will adapt the content to your
                preferences. Highlight any text to ask questions about it.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900">
                Quick Actions
              </h3>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => {
                    chrome.runtime.sendMessage({ type: "TRANSFORM_PAGE", payload: {} });
                  }}
                  disabled={!isEnabled}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Simplify this page
                </button>
                <button
                  disabled
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 cursor-not-allowed"
                >
                  Find benefits for me (coming soon)
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="benefits" className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">
              Benefits Discovery
            </h3>
            <p className="mt-1 text-sm text-gray-500 max-w-[240px]">
              Coming in Phase 3. Ivy will help you find government benefits
              you may be eligible for.
            </p>
          </div>
        </Tabs.Content>

        <Tabs.Content value="settings" className="flex-1 overflow-y-auto">
          <PreferencesPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
