import { Redis } from "@upstash/redis/cloudflare";
import { TRANSFORM_CACHE_TTL } from "@ivy/shared";

export function createRedis(url: string, token: string) {
  return new Redis({ url, token });
}

export async function getCachedTransform(
  redis: Redis,
  urlHash: string,
  prefHash: string
): Promise<unknown[] | null> {
  const key = `transform:${urlHash}:${prefHash}`;
  const cached = await redis.get<unknown[]>(key);
  return cached;
}

export async function setCachedTransform(
  redis: Redis,
  urlHash: string,
  prefHash: string,
  instructions: unknown[]
): Promise<void> {
  const key = `transform:${urlHash}:${prefHash}`;
  await redis.set(key, instructions, { ex: TRANSFORM_CACHE_TTL });
}

export async function getCachedExplanation(
  redis: Redis,
  textHash: string
): Promise<string | null> {
  const key = `explain:${textHash}`;
  return redis.get<string>(key);
}

export async function setCachedExplanation(
  redis: Redis,
  textHash: string,
  answer: string
): Promise<void> {
  const key = `explain:${textHash}`;
  await redis.set(key, answer, { ex: 7 * 24 * 60 * 60 }); // 7 days
}

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
