import { useState, useRef, useEffect } from "react";
import { usePreferencesStore } from "../lib/store";
import type { UserPreferences, ReadingLevel, JargonLevel } from "@ivy/shared";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const ONBOARDING_STEPS = [
  {
    question:
      "Welcome to aiKea! I'm here to help make the web easier for you. Let's set things up. How would you describe your reading comfort level?",
    options: [
      { label: "Keep it very simple (elementary)", value: "elementary" },
      { label: "Somewhere in the middle", value: "middle-school" },
      { label: "I'm comfortable with most text", value: "high-school" },
      { label: "Don't simplify anything", value: "original" },
    ],
    prefKey: "readingLevel" as const,
  },
  {
    question: "Would you like me to explain technical terms and jargon when I find them?",
    options: [
      { label: "Yes, explain everything", value: "none" },
      { label: "Just the hard ones", value: "minimal" },
      { label: "Only very technical terms", value: "moderate" },
      { label: "No, leave them as-is", value: "original" },
    ],
    prefKey: "jargonLevel" as const,
  },
  {
    question: "Do you need any visual adjustments to make reading easier?",
    options: [
      { label: "Larger text", value: "font" },
      { label: "High contrast colors", value: "contrast" },
      { label: "Both", value: "both" },
      { label: "No changes needed", value: "none" },
    ],
    prefKey: null,
  },
  {
    question:
      "Is there anything else I should know? For example: 'I have low vision', 'English is my second language', or 'I need help with government forms'.",
    options: [],
    prefKey: "customNeeds" as const,
  },
];

export function PreferenceChat() {
  const { setPreferences, setOnboarded } = usePreferencesStore();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: ONBOARDING_STEPS[0].question },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const collectedPrefs = useRef<Partial<UserPreferences>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleOptionSelect(value: string) {
    const currentStep = ONBOARDING_STEPS[step];

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content:
          currentStep.options.find((o) => o.value === value)?.label ?? value,
      },
    ]);

    // Apply preference
    if (currentStep.prefKey === "readingLevel") {
      collectedPrefs.current.readingLevel = value as ReadingLevel;
    } else if (currentStep.prefKey === "jargonLevel") {
      collectedPrefs.current.jargonLevel = value as JargonLevel;
    } else if (currentStep.prefKey === null) {
      // Visual adjustments step
      if (value === "font" || value === "both") {
        collectedPrefs.current.fontScale = 1.25;
      }
      if (value === "contrast" || value === "both") {
        collectedPrefs.current.highContrast = true;
      }
    }

    advanceStep();
  }

  function handleFreeInput() {
    if (!input.trim()) return;

    const currentStep = ONBOARDING_STEPS[step];
    setMessages((prev) => [...prev, { role: "user", content: input }]);

    if (currentStep.prefKey === "customNeeds") {
      collectedPrefs.current.customNeeds = [input.trim()];
    }

    setInput("");
    advanceStep();
  }

  function advanceStep() {
    const nextStep = step + 1;
    if (nextStep < ONBOARDING_STEPS.length) {
      setStep(nextStep);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: ONBOARDING_STEPS[nextStep].question },
        ]);
      }, 500);
    } else {
      // Onboarding complete
      setPreferences(collectedPrefs.current);
      setOnboarded(true);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "All set! I'll start adapting web pages to your preferences. You can always change these in Settings. Click the aiKea icon on any page to get started.",
          },
        ]);
      }, 500);
    }
  }

  const currentStep = step < ONBOARDING_STEPS.length ? ONBOARDING_STEPS[step] : null;
  const isComplete = step >= ONBOARDING_STEPS.length;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Options / Input */}
      {!isComplete && currentStep && (
        <div className="border-t border-gray-200 p-4 space-y-2">
          {currentStep.options.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {currentStep.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleOptionSelect(opt.value)}
                  className="text-left px-4 py-2 rounded-xl border border-gray-200 hover:border-violet-400 hover:bg-violet-50 text-sm transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFreeInput();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type anything, or press Skip..."
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm hover:bg-violet-700 transition-colors"
              >
                {input.trim() ? "Send" : "Skip"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
