import type { DomainInsights, PageInsights } from "@ivy/shared/dashboard";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function fetchDomainInsights(
  domain: string
): Promise<DomainInsights> {
  const res = await fetch(
    `${API_BASE}/dashboard/${encodeURIComponent(domain)}`
  );
  const json = (await res.json()) as {
    success: boolean;
    data: DomainInsights;
    error?: { message: string };
  };
  if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch");
  return json.data;
}

export async function fetchPageInsights(
  domain: string,
  path: string
): Promise<PageInsights> {
  const res = await fetch(
    `${API_BASE}/dashboard/${encodeURIComponent(domain)}/page?path=${encodeURIComponent(path)}`
  );
  const json = (await res.json()) as {
    success: boolean;
    data: PageInsights;
    error?: { message: string };
  };
  if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch");
  return json.data;
}
