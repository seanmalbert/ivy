import type {
  InteractionType,
  FeedbackCategory,
  SelectorInsight,
  PageInsights,
  DomainInsights,
} from "@ivy/shared/dashboard";

export type { InteractionType, FeedbackCategory, SelectorInsight, PageInsights, DomainInsights };

const MAX_INTERACTIONS_PER_DOMAIN = 10_000;

// ── Types ──

export interface PageInteraction {
  id: string;
  domain: string;
  urlPath: string;
  fullUrl: string;
  selector: string;
  eventType: InteractionType;
  content: string;
  response?: string;
  category?: FeedbackCategory;
  createdAt: string;
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
    // Keep samples and responses aligned by index
    const recentItems = group.items.slice(-3).filter((i) => i.content);
    insights.push({
      selector: first.selector,
      eventType: first.eventType,
      count: group.items.length,
      samples: recentItems.map((i) => i.content),
      responses: recentItems.map((i) => i.response ?? ""),
    });
  }

  // Sort by count descending
  insights.sort((a, b) => b.count - a.count);

  // Top questions -- keep original casing and selector
  const questionMap = new Map<string, { question: string; selector: string; count: number }>();
  for (const i of interactions) {
    if (i.eventType === "asked" && i.content) {
      const key = i.content.toLowerCase().trim();
      const existing = questionMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        questionMap.set(key, { question: i.content, selector: i.selector, count: 1 });
      }
    }
  }
  const topQuestions = Array.from(questionMap.values())
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
