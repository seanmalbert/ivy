/** API base URLs — overridden at build time per package */
export const API_BASE_URL = "http://localhost:8787";
export const AI_SERVICE_URL = "http://localhost:3001";

/** Cache TTLs (seconds) */
export const TRANSFORM_CACHE_TTL = 24 * 60 * 60; // 24 hours
export const FORM_GUIDANCE_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

/** Reading level grade mappings */
export const READING_LEVEL_GRADES: Record<string, number> = {
  elementary: 4,
  "middle-school": 7,
  "high-school": 10,
  college: 13,
  original: 99,
};

/** Default user preferences */
export const DEFAULT_PREFERENCES = {
  readingLevel: "original" as const,
  language: "en",
  fontScale: 1.0,
  highContrast: false,
  reduceMotion: false,
  jargonLevel: "original" as const,
  customNeeds: [] as string[],
};

/** Extension storage keys */
export const STORAGE_KEYS = {
  PREFERENCES: "ivy_preferences",
  AUTH_TOKEN: "ivy_auth_token",
  VAULT_SALT: "ivy_vault_salt",
  IVY_ENABLED: "ivy_enabled",
  ONBOARDING_COMPLETE: "ivy_onboarding_complete",
} as const;
