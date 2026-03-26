const MAX_INTERACTIONS_PER_DOMAIN = 10_000;

// ── Types ──

export type InteractionType = "simplified" | "asked" | "form-help" | "comment";

export type FeedbackCategory =
  | "confusing-language"
  | "missing-info"
  | "broken-feature"
  | "accessibility"
  | "navigation"
  | "positive"
  | "other";

export interface PageInteraction {
  id: string;
  domain: string;
  urlPath: string;
  fullUrl: string;
  selector: string;
  eventType: InteractionType;
  content: string;
  category?: FeedbackCategory;
  createdAt: string;
}

export interface SelectorInsight {
  selector: string;
  eventType: InteractionType;
  count: number;
  samples: string[];
}

export interface PageInsights {
  urlPath: string;
  totalInteractions: number;
  insights: SelectorInsight[];
  topQuestions: Array<{ question: string; count: number }>;
  categoryDistribution: Record<string, number>;
}

export interface DomainInsights {
  domain: string;
  totalInteractions: number;
  pages: PageInsights[];
}

// ── Store ──

const store = new Map<string, PageInteraction[]>();

export function addInteraction(
  data: Omit<PageInteraction, "id" | "createdAt">
): PageInteraction {
  const interaction: PageInteraction = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const list = store.get(data.domain) ?? [];
  list.push(interaction);

  // FIFO eviction
  if (list.length > MAX_INTERACTIONS_PER_DOMAIN) {
    list.splice(0, list.length - MAX_INTERACTIONS_PER_DOMAIN);
  }

  store.set(data.domain, list);
  return interaction;
}

export function getByDomain(domain: string): PageInteraction[] {
  return store.get(domain) ?? [];
}

export function getByDomainAndPath(
  domain: string,
  urlPath: string
): PageInteraction[] {
  return getByDomain(domain).filter((i) => i.urlPath === urlPath);
}

export function getPageInsights(
  domain: string,
  urlPath: string
): PageInsights {
  const interactions = getByDomainAndPath(domain, urlPath);

  // Group by selector + eventType
  const groups = new Map<string, { items: PageInteraction[] }>();
  for (const i of interactions) {
    const key = `${i.selector}::${i.eventType}`;
    const group = groups.get(key) ?? { items: [] };
    group.items.push(i);
    groups.set(key, group);
  }

  const insights: SelectorInsight[] = [];
  for (const [, group] of groups) {
    const first = group.items[0];
    insights.push({
      selector: first.selector,
      eventType: first.eventType,
      count: group.items.length,
      samples: group.items
        .slice(-3)
        .map((i) => i.content)
        .filter(Boolean),
    });
  }

  // Sort by count descending
  insights.sort((a, b) => b.count - a.count);

  // Top questions
  const questionCounts = new Map<string, number>();
  for (const i of interactions) {
    if (i.eventType === "asked" && i.content) {
      const q = i.content.toLowerCase().trim();
      questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1);
    }
  }
  const topQuestions = Array.from(questionCounts.entries())
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  for (const i of interactions) {
    if (i.category) {
      categoryDistribution[i.category] =
        (categoryDistribution[i.category] ?? 0) + 1;
    }
  }

  return {
    urlPath,
    totalInteractions: interactions.length,
    insights,
    topQuestions,
    categoryDistribution,
  };
}

export function getAggregatedInsights(domain: string): DomainInsights {
  const interactions = getByDomain(domain);

  // Group by urlPath
  const pathSet = new Set(interactions.map((i) => i.urlPath));
  const pages = Array.from(pathSet)
    .map((urlPath) => getPageInsights(domain, urlPath))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);

  return {
    domain,
    totalInteractions: interactions.length,
    pages,
  };
}

/** Clear all data (useful for testing) */
export function clearStore() {
  store.clear();
}
