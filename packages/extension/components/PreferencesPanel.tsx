import * as Select from "@radix-ui/react-select";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";
import * as Label from "@radix-ui/react-label";
import { usePreferencesStore } from "../lib/store";
import type { ReadingLevel, JargonLevel } from "@ivy/shared";

const READING_LEVELS: { value: ReadingLevel; label: string }[] = [
  { value: "elementary", label: "Elementary (very simple)" },
  { value: "middle-school", label: "Middle school" },
  { value: "high-school", label: "High school" },
  { value: "college", label: "College level" },
  { value: "original", label: "Original (no changes)" },
];

const JARGON_LEVELS: { value: JargonLevel; label: string }[] = [
  { value: "none", label: "Explain all jargon" },
  { value: "minimal", label: "Explain difficult terms" },
  { value: "moderate", label: "Only very technical" },
  { value: "original", label: "Leave as-is" },
];

export function PreferencesPanel() {
  const { preferences, setPreferences } = usePreferencesStore();

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>

      {/* Reading Level */}
      <div className="space-y-2">
        <Label.Root className="text-sm font-medium text-gray-700">
          Reading Level
        </Label.Root>
        <Select.Root
          value={preferences.readingLevel}
          onValueChange={(val) => setPreferences({ readingLevel: val as ReadingLevel })}
        >
          <Select.Trigger className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white hover:border-violet-400 focus:outline-none focus:border-violet-500">
            <Select.Value />
            <Select.Icon className="text-gray-400">▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-50">
              <Select.Viewport className="p-1">
                {READING_LEVELS.map((level) => (
                  <Select.Item
                    key={level.value}
                    value={level.value}
                    className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-violet-50 focus:bg-violet-50 outline-none data-[highlighted]:bg-violet-50"
                  >
                    <Select.ItemText>{level.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Jargon Level */}
      <div className="space-y-2">
        <Label.Root className="text-sm font-medium text-gray-700">
          Jargon Handling
        </Label.Root>
        <Select.Root
          value={preferences.jargonLevel}
          onValueChange={(val) => setPreferences({ jargonLevel: val as JargonLevel })}
        >
          <Select.Trigger className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white hover:border-violet-400 focus:outline-none focus:border-violet-500">
            <Select.Value />
            <Select.Icon className="text-gray-400">▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-50">
              <Select.Viewport className="p-1">
                {JARGON_LEVELS.map((level) => (
                  <Select.Item
                    key={level.value}
                    value={level.value}
                    className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-violet-50 focus:bg-violet-50 outline-none data-[highlighted]:bg-violet-50"
                  >
                    <Select.ItemText>{level.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Font Scale */}
      <div className="space-y-2">
        <Label.Root className="text-sm font-medium text-gray-700">
          Text Size: {Math.round(preferences.fontScale * 100)}%
        </Label.Root>
        <Slider.Root
          className="relative flex items-center w-full h-5"
          value={[preferences.fontScale]}
          onValueChange={([val]) => setPreferences({ fontScale: val })}
          min={0.75}
          max={2.0}
          step={0.05}
        >
          <Slider.Track className="relative h-1 w-full rounded-full bg-gray-200">
            <Slider.Range className="absolute h-full rounded-full bg-violet-500" />
          </Slider.Track>
          <Slider.Thumb className="block w-4 h-4 rounded-full bg-violet-600 shadow focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </Slider.Root>
      </div>

      {/* High Contrast */}
      <div className="flex items-center justify-between">
        <Label.Root className="text-sm font-medium text-gray-700">
          High Contrast
        </Label.Root>
        <Switch.Root
          checked={preferences.highContrast}
          onCheckedChange={(checked) => setPreferences({ highContrast: checked })}
          className="w-10 h-6 rounded-full bg-gray-200 data-[state=checked]:bg-violet-600 transition-colors"
        >
          <Switch.Thumb className="block w-5 h-5 rounded-full bg-white shadow transform transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      </div>

      {/* Reduce Motion */}
      <div className="flex items-center justify-between">
        <Label.Root className="text-sm font-medium text-gray-700">
          Reduce Motion
        </Label.Root>
        <Switch.Root
          checked={preferences.reduceMotion}
          onCheckedChange={(checked) => setPreferences({ reduceMotion: checked })}
          className="w-10 h-6 rounded-full bg-gray-200 data-[state=checked]:bg-violet-600 transition-colors"
        >
          <Switch.Thumb className="block w-5 h-5 rounded-full bg-white shadow transform transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      </div>
    </div>
  );
}
