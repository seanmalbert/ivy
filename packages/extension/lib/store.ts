import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_PREFERENCES, STORAGE_KEYS } from "@ivy/shared";
import type { UserPreferences } from "@ivy/shared";

// ── Chrome storage adapter for Zustand ──

const chromeStorage = createJSONStorage<PreferencesState>(() => ({
  getItem: async (key: string) => {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },
  setItem: async (key: string, value: string) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string) => {
    await chrome.storage.local.remove(key);
  },
}));

// ── Preferences Store ──

interface PreferencesState {
  preferences: UserPreferences & { userId: string };
  isEnabled: boolean;
  isOnboarded: boolean;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setEnabled: (enabled: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences & { userId: string } = {
  userId: "",
  ...DEFAULT_PREFERENCES,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      isEnabled: true,
      isOnboarded: false,

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      setOnboarded: (onboarded) => set({ isOnboarded: onboarded }),

      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: STORAGE_KEYS.PREFERENCES,
      storage: chromeStorage,
    }
  )
);

// ── Auth Store ──

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  setAuth: (isAuthenticated: boolean, userId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  userId: null,
  setAuth: (isAuthenticated, userId) => set({ isAuthenticated, userId }),
  logout: () => set({ isAuthenticated: false, userId: null }),
}));

// ── Transform Store ──

type TransformStatus = "idle" | "transforming" | "done" | "error";

interface TransformState {
  status: TransformStatus;
  lastTransformMs: number | null;
  wasCached: boolean;
  transformedCount: number;
  error: string | null;
  setStatus: (status: TransformStatus) => void;
  setResult: (ms: number, cached: boolean, count?: number) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useTransformStore = create<TransformState>()((set) => ({
  status: "idle",
  lastTransformMs: null,
  wasCached: false,
  transformedCount: 0,
  error: null,
  setStatus: (status) => set({ status, error: null }),
  setResult: (ms, cached, count) =>
    set({ status: "done", lastTransformMs: ms, wasCached: cached, transformedCount: count ?? 0, error: null }),
  setError: (error) => set({ status: "error", error }),
  reset: () => set({ status: "idle", lastTransformMs: null, wasCached: false, transformedCount: 0, error: null }),
}));
