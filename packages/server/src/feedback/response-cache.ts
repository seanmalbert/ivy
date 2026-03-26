import { createHash } from "node:crypto";

export interface CachedResponse {
  id: string;
  cacheKey: string;
  url: string;
  text: string;
  response: string;
  editedBy?: string;
  editedAt?: string;
  createdAt: string;
}

// Keyed by hash of (url + text)
const cache = new Map<string, CachedResponse>();

export function buildCacheKey(url: string, text: string): string {
  const normalized = `${url.trim().toLowerCase()}::${text.trim().toLowerCase()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function getCachedResponse(url: string, text: string): CachedResponse | null {
  const key = buildCacheKey(url, text);
  return cache.get(key) ?? null;
}

export function setCachedResponse(url: string, text: string, response: string): CachedResponse {
  const key = buildCacheKey(url, text);
  const existing = cache.get(key);
  if (existing) {
    // Don't overwrite an edited response
    if (existing.editedBy) return existing;
    existing.response = response;
    return existing;
  }

  const entry: CachedResponse = {
    id: crypto.randomUUID(),
    cacheKey: key,
    url,
    text: text.slice(0, 500),
    response,
    createdAt: new Date().toISOString(),
  };
  cache.set(key, entry);
  return entry;
}

export function updateCachedResponse(
  id: string,
  newResponse: string,
  editedBy?: string
): CachedResponse | null {
  for (const entry of cache.values()) {
    if (entry.id === id) {
      entry.response = newResponse;
      entry.editedBy = editedBy ?? "site-owner";
      entry.editedAt = new Date().toISOString();
      return entry;
    }
  }
  return null;
}

export function getAllCachedResponses(): CachedResponse[] {
  return Array.from(cache.values());
}

export function clearResponseCache() {
  cache.clear();
}
