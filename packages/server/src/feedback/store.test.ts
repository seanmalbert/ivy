import { describe, it, expect, beforeEach } from "vitest";
import {
  addInteraction,
  getByDomain,
  getByDomainAndPath,
  getPageInsights,
  getAggregatedInsights,
  clearStore,
} from "./store.js";

beforeEach(() => {
  clearStore();
});

describe("addInteraction", () => {
  it("stores and returns an interaction with id and timestamp", () => {
    const result = addInteraction({
      domain: "ssa.gov",
      urlPath: "/benefits",
      fullUrl: "https://ssa.gov/benefits",
      selector: "#main > p",
      eventType: "simplified",
      content: "Simplified paragraph",
    });

    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.domain).toBe("ssa.gov");
    expect(result.eventType).toBe("simplified");
  });

  it("retrieves stored interactions by domain", () => {
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/",
      fullUrl: "https://ssa.gov/",
      selector: "body",
      eventType: "comment",
      content: "Confusing page",
      category: "confusing-language",
    });

    const results = getByDomain("ssa.gov");
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Confusing page");
  });

  it("returns empty array for unknown domain", () => {
    expect(getByDomain("unknown.com")).toEqual([]);
  });
});

describe("getByDomainAndPath", () => {
  it("filters by domain and path", () => {
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/benefits",
      fullUrl: "https://ssa.gov/benefits",
      selector: "#a",
      eventType: "simplified",
      content: "A",
    });
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/contact",
      fullUrl: "https://ssa.gov/contact",
      selector: "#b",
      eventType: "asked",
      content: "B",
    });

    const results = getByDomainAndPath("ssa.gov", "/benefits");
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("A");
  });
});

describe("getPageInsights", () => {
  it("groups interactions by selector and eventType", () => {
    for (let i = 0; i < 3; i++) {
      addInteraction({
        domain: "ssa.gov",
        urlPath: "/benefits",
        fullUrl: "https://ssa.gov/benefits",
        selector: "#main",
        eventType: "simplified",
        content: `Simplified ${i}`,
      });
    }
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/benefits",
      fullUrl: "https://ssa.gov/benefits",
      selector: "#main",
      eventType: "asked",
      content: "What does this mean?",
    });

    const insights = getPageInsights("ssa.gov", "/benefits");
    expect(insights.totalInteractions).toBe(4);
    expect(insights.insights).toHaveLength(2);

    const simplified = insights.insights.find((i) => i.eventType === "simplified");
    expect(simplified?.count).toBe(3);
    expect(simplified?.samples).toHaveLength(3);
  });

  it("aggregates top questions", () => {
    for (let i = 0; i < 5; i++) {
      addInteraction({
        domain: "ssa.gov",
        urlPath: "/",
        fullUrl: "https://ssa.gov/",
        selector: "#faq",
        eventType: "asked",
        content: "What is SNAP?",
      });
    }
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/",
      fullUrl: "https://ssa.gov/",
      selector: "#faq",
      eventType: "asked",
      content: "How do I apply?",
    });

    const insights = getPageInsights("ssa.gov", "/");
    expect(insights.topQuestions[0].question).toBe("What is SNAP?");
    expect(insights.topQuestions[0].selector).toBe("#faq");
    expect(insights.topQuestions[0].count).toBe(5);
    expect(insights.topQuestions[1].count).toBe(1);
  });

  it("tracks category distribution", () => {
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/",
      fullUrl: "https://ssa.gov/",
      selector: "body",
      eventType: "comment",
      content: "Hard to read",
      category: "confusing-language",
    });
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/",
      fullUrl: "https://ssa.gov/",
      selector: "body",
      eventType: "comment",
      content: "Where is the form?",
      category: "missing-info",
    });
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/",
      fullUrl: "https://ssa.gov/",
      selector: "#nav",
      eventType: "comment",
      content: "Also hard",
      category: "confusing-language",
    });

    const insights = getPageInsights("ssa.gov", "/");
    expect(insights.categoryDistribution["confusing-language"]).toBe(2);
    expect(insights.categoryDistribution["missing-info"]).toBe(1);
  });

  it("returns empty insights for unknown path", () => {
    const insights = getPageInsights("ssa.gov", "/nonexistent");
    expect(insights.totalInteractions).toBe(0);
    expect(insights.insights).toEqual([]);
  });
});

describe("getAggregatedInsights", () => {
  it("groups pages by urlPath sorted by interaction count", () => {
    for (let i = 0; i < 5; i++) {
      addInteraction({
        domain: "ssa.gov",
        urlPath: "/benefits",
        fullUrl: "https://ssa.gov/benefits",
        selector: "#main",
        eventType: "simplified",
        content: `Content ${i}`,
      });
    }
    addInteraction({
      domain: "ssa.gov",
      urlPath: "/contact",
      fullUrl: "https://ssa.gov/contact",
      selector: "#form",
      eventType: "form-help",
      content: "",
    });

    const domain = getAggregatedInsights("ssa.gov");
    expect(domain.totalInteractions).toBe(6);
    expect(domain.pages).toHaveLength(2);
    expect(domain.pages[0].urlPath).toBe("/benefits");
    expect(domain.pages[0].totalInteractions).toBe(5);
    expect(domain.pages[1].urlPath).toBe("/contact");
  });

  it("returns empty for unknown domain", () => {
    const domain = getAggregatedInsights("unknown.com");
    expect(domain.totalInteractions).toBe(0);
    expect(domain.pages).toEqual([]);
  });
});
