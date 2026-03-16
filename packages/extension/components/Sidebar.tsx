import { useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { usePreferencesStore, useTransformStore, useBenefitsStore, useEligibilityStore } from "../lib/store";
import { PreferenceChat } from "./PreferenceChat";
import { PreferencesPanel } from "./PreferencesPanel";
import { EligibilityForm } from "./EligibilityForm";
import { BenefitsResults } from "./BenefitsResults";

export function Sidebar() {
  const { isOnboarded, isEnabled, setEnabled } = usePreferencesStore();
  const { status, lastTransformMs, wasCached, transformedCount, error, setResult, setStatus, setError, reset } =
    useTransformStore();
  const benefits = useBenefitsStore();
  const eligibility = useEligibilityStore();

  // Listen for transform status updates from the service worker
  useEffect(() => {
    const listener = (msg: unknown) => {
      const m = msg as { type?: string; payload?: Record<string, unknown> };
      if (m.type === "TRANSFORM_STATUS" && m.payload) {
        const p = m.payload;
        switch (p.status) {
          case "transforming":
            setStatus("transforming");
            break;
          case "done":
            setResult(
              (p.processingMs as number) ?? 0,
              (p.cached as boolean) ?? false,
              (p.transformedCount as number) ?? 0
            );
            break;
          case "error":
            setError((p.message as string) ?? "Transform failed");
            break;
        }
      }

      if (m.type === "BENEFITS_STATUS" && m.payload) {
        const p = m.payload;
        switch (p.status) {
          case "evaluating":
            benefits.setStatus("evaluating");
            break;
          case "done":
            benefits.setResults(
              (p.recommendations as unknown[]) as import("@ivy/shared").BenefitRecommendation[],
              (p.processingMs as number) ?? 0
            );
            break;
          case "error":
            benefits.setError((p.message as string) ?? "Benefits evaluation failed");
            break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setResult, setStatus, setError, benefits.setStatus, benefits.setResults, benefits.setError]);

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
          <TransformBadge
            status={status}
            lastMs={lastTransformMs}
            cached={wasCached}
          />
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
              data-value={tab}
              className="px-3 py-2 text-sm text-gray-500 capitalize border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 transition-colors"
            >
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="home" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Status banner */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-xs text-red-500 mt-1">
                  Make sure the API (localhost:8787) and AI service (localhost:3001) are running.
                </p>
              </div>
            )}

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
                    chrome.runtime.sendMessage({
                      type: "TRANSFORM_PAGE",
                      payload: {},
                    });
                  }}
                  disabled={!isEnabled || status === "transforming"}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-between"
                >
                  <span>
                    {status === "transforming"
                      ? "Simplifying..."
                      : "Simplify this page"}
                  </span>
                  {status === "transforming" && (
                    <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  )}
                </button>
                <button
                  onClick={() => {
                    // Switch to benefits tab — user will fill form there
                    const benefitsTab = document.querySelector('[data-value="benefits"]') as HTMLElement | null;
                    benefitsTab?.click();
                  }}
                  disabled={!isEnabled}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Find benefits for me
                </button>
              </div>
            </div>

            {status === "done" && transformedCount > 0 && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-700">
                    Simplified {transformedCount} section{transformedCount !== 1 ? "s" : ""}
                    {lastTransformMs ? ` in ${lastTransformMs}ms` : ""}
                    {wasCached ? " (cached)" : ""}
                  </p>
                  <button
                    onClick={() => {
                      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]?.id) {
                          chrome.tabs.sendMessage(tabs[0].id, {
                            type: "UNDO_TRANSFORMS",
                            payload: {},
                          });
                        }
                      });
                      reset();
                    }}
                    className="text-xs text-green-600 hover:text-green-800 underline ml-2 whitespace-nowrap"
                  >
                    Undo
                  </button>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Simplified sections have a purple left border. Hover to see the label.
                </p>
              </div>
            )}
            {status === "done" && transformedCount === 0 && (
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm text-yellow-700">
                  No sections needed simplification on this page.
                </p>
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="benefits" className="flex-1 overflow-y-auto p-4">
          {benefits.status === "done" && benefits.recommendations.length > 0 ? (
            <BenefitsResults
              recommendations={benefits.recommendations}
              processingMs={benefits.processingMs}
              onReset={benefits.reset}
            />
          ) : (
            <div className="space-y-3">
              {benefits.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{benefits.error}</p>
                </div>
              )}
              <EligibilityForm
                isEvaluating={benefits.status === "evaluating"}
                onSubmit={() => {
                  chrome.runtime.sendMessage({
                    type: "EVALUATE_BENEFITS",
                    payload: {
                      profile: {
                        incomeBracket: eligibility.incomeBracket,
                        state: eligibility.state,
                        householdSize: eligibility.householdSize,
                        hasDisability: eligibility.hasDisability,
                        veteranStatus: eligibility.veteranStatus,
                        ageBracket: eligibility.ageBracket,
                      },
                    },
                  });
                }}
              />
              {benefits.status === "done" && benefits.recommendations.length === 0 && (
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-700">
                    No benefits matched your profile. Try updating your information or check back later.
                  </p>
                </div>
              )}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="settings" className="flex-1 overflow-y-auto">
          <PreferencesPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TransformBadge({
  status,
  lastMs,
  cached,
}: {
  status: string;
  lastMs: number | null;
  cached: boolean;
}) {
  if (status === "transforming") {
    return (
      <span className="text-xs text-violet-600 animate-pulse">
        Transforming...
      </span>
    );
  }
  if (status === "done" && lastMs !== null) {
    return (
      <span className="text-xs text-gray-400">
        {lastMs}ms{cached ? " (cached)" : ""}
      </span>
    );
  }
  if (status === "error") {
    return <span className="text-xs text-red-500">Error</span>;
  }
  return null;
}
