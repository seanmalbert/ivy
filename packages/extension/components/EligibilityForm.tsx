import * as Select from "@radix-ui/react-select";
import * as Switch from "@radix-ui/react-switch";
import { useEligibilityStore } from "../lib/store";

const INCOME_BRACKETS = [
  { value: "0-10k", label: "Under $10,000" },
  { value: "10k-20k", label: "$10,000 - $20,000" },
  { value: "20k-30k", label: "$20,000 - $30,000" },
  { value: "30k-40k", label: "$30,000 - $40,000" },
  { value: "40k-50k", label: "$40,000 - $50,000" },
  { value: "50k-75k", label: "$50,000 - $75,000" },
  { value: "75k-100k", label: "$75,000 - $100,000" },
  { value: "100k+", label: "Over $100,000" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const AGE_BRACKETS = [
  { value: "under-18", label: "Under 18" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55-64", label: "55-64" },
  { value: "65+", label: "65 or older" },
];

const HOUSEHOLD_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

interface EligibilityFormProps {
  onSubmit: () => void;
  isEvaluating: boolean;
}

export function EligibilityForm({ onSubmit, isEvaluating }: EligibilityFormProps) {
  const { incomeBracket, state, householdSize, hasDisability, veteranStatus, ageBracket, setField } =
    useEligibilityStore();

  const hasMinimumInfo = incomeBracket || hasDisability || veteranStatus || ageBracket;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-violet-50 p-3">
        <p className="text-sm text-violet-700 leading-relaxed">
          Answer a few questions and aiKea will find government benefits you may qualify for.
          All information stays on your device.
        </p>
      </div>

      {/* Income */}
      <FieldGroup label="Approximate household income (yearly)">
        <SelectField
          value={incomeBracket}
          onValueChange={(v) => setField("incomeBracket", v)}
          placeholder="Select income range"
          items={INCOME_BRACKETS}
        />
      </FieldGroup>

      {/* State */}
      <FieldGroup label="State">
        <SelectField
          value={state}
          onValueChange={(v) => setField("state", v)}
          placeholder="Select state"
          items={US_STATES.map((s) => ({ value: s, label: s }))}
        />
      </FieldGroup>

      {/* Household Size */}
      <FieldGroup label="Household size">
        <SelectField
          value={householdSize?.toString() ?? null}
          onValueChange={(v) => setField("householdSize", parseInt(v, 10))}
          placeholder="Select household size"
          items={HOUSEHOLD_SIZES.map((n) => ({ value: n.toString(), label: `${n} ${n === 1 ? "person" : "people"}` }))}
        />
      </FieldGroup>

      {/* Age */}
      <FieldGroup label="Age range">
        <SelectField
          value={ageBracket}
          onValueChange={(v) => setField("ageBracket", v)}
          placeholder="Select age range"
          items={AGE_BRACKETS}
        />
      </FieldGroup>

      {/* Disability */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-700">Do you have a disability?</label>
        <Switch.Root
          checked={hasDisability ?? false}
          onCheckedChange={(v) => setField("hasDisability", v)}
          className="w-9 h-5 rounded-full bg-gray-200 data-[state=checked]:bg-violet-600 transition-colors"
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      </div>

      {/* Veteran */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-700">Are you a veteran?</label>
        <Switch.Root
          checked={veteranStatus ?? false}
          onCheckedChange={(v) => setField("veteranStatus", v)}
          className="w-9 h-5 rounded-full bg-gray-200 data-[state=checked]:bg-violet-600 transition-colors"
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      </div>

      <button
        onClick={onSubmit}
        disabled={!hasMinimumInfo || isEvaluating}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isEvaluating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Finding benefits...
          </>
        ) : (
          "Find my benefits"
        )}
      </button>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onValueChange,
  placeholder,
  items,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder: string;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <Select.Root value={value ?? undefined} onValueChange={onValueChange}>
      <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 data-[placeholder]:text-gray-400">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-gray-400">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-[9999]"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="max-h-[200px] overflow-y-auto p-1">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="px-3 py-1.5 text-sm text-gray-900 rounded cursor-pointer outline-none hover:bg-violet-50 data-[highlighted]:bg-violet-50"
              >
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
