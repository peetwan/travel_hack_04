// Lightweight clients for the three search providers we use in Web Pulse.
// Direct fetch instead of SDKs so we keep dependencies and bundle small.

import type { WebEvidenceProviderReport } from "./types";

const THAI_TRAVEL_DOMAINS = [
  "pantip.com",
  "chillpainai.com",
  "readme.me",
  "paiduaykan.com",
  "mushroomtravel.com",
  "tourismthailand.org",
  "dasta.or.th",
  "museumthailand.com",
  "travel.trueid.net",
  "roigoo.com",
];

const LUXURY_TRAVEL_DOMAINS = [
  "cntraveler.com",
  "travelandleisure.com",
  "robbreport.com",
  "tatlerasia.com",
  "forbestravelguide.com",
  "departures.com",
  "lonelyplanet.com",
  "afar.com",
  "mrandmrssmith.com",
  "tourismthailand.org",
  "worldspaawards.com",
  "michelin.com",
];

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
  source: "tavily" | "exa" | "firecrawl";
  published_at?: string;
  scraped_at?: string;
  evidence_level?: "search-snippet" | "page-scrape";
}

export interface WebSearchResult {
  query: string;
  searched_at: string;
  freshness_note: string;
  provider_statuses: WebEvidenceProviderReport[];
  source_counts: {
    tavily?: number;
    exa?: number;
    firecrawl?: number;
  };
  hits: WebHit[];
}

export async function tavilySearch(args: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  signal?: AbortSignal;
}): Promise<WebHit[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: args.query,
      search_depth: "basic",
      max_results: args.maxResults ?? 5,
      include_domains: args.includeDomains ?? THAI_TRAVEL_DOMAINS,
      include_answer: false,
    }),
    signal: args.signal,
  });

  if (!res.ok) throw new Error(`Tavily search failed with HTTP ${res.status}.`);
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.content ?? "").slice(0, 400),
    source: "tavily" as const,
    published_at: r.published_date,
    evidence_level: "search-snippet" as const,
  }));
}

export async function exaSearch(args: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  signal?: AbortSignal;
}): Promise<WebHit[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: args.query,
      numResults: args.maxResults ?? 5,
      includeDomains: args.includeDomains ?? THAI_TRAVEL_DOMAINS,
      type: "neural",
      contents: { text: { maxCharacters: 400 } },
    }),
    signal: args.signal,
  });

  if (!res.ok) throw new Error(`Exa search failed with HTTP ${res.status}.`);
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      publishedDate?: string;
    }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.text ?? "").slice(0, 400),
    source: "exa" as const,
    published_at: r.publishedDate,
    evidence_level: "search-snippet" as const,
  }));
}

export async function firecrawlScrape(args: {
  url: string;
  signal?: AbortSignal;
}): Promise<{ markdown: string; title?: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: args.url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
    signal: args.signal,
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    success?: boolean;
    data?: { markdown?: string; metadata?: { title?: string } };
  };
  if (!data.success || !data.data?.markdown) return null;
  return {
    markdown: data.data.markdown,
    title: data.data.metadata?.title,
  };
}

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function runProvider(
  provider: "tavily" | "exa",
  envName: "TAVILY_API_KEY" | "EXA_API_KEY",
  search: () => Promise<WebHit[]>
): Promise<{ hits: WebHit[]; report: WebEvidenceProviderReport }> {
  if (!hasEnv(envName)) {
    return {
      hits: [],
      report: {
        provider,
        status: "missing-key",
        hit_count: 0,
        message: `${envName} is not configured.`,
      },
    };
  }

  try {
    const hits = await search();
    return {
      hits,
      report: { provider, status: "ok", hit_count: hits.length },
    };
  } catch (err) {
    const timeout = isAbortError(err);
    return {
      hits: [],
      report: {
        provider,
        status: timeout ? "timeout" : "error",
        hit_count: 0,
        message: timeout
          ? "Search timed out before returning usable hits."
          : err instanceof Error
            ? err.message
            : "Search request failed.",
      },
    };
  }
}

function dedupeHits(hits: WebHit[], maxResults: number): WebHit[] {
  const seen = new Set<string>();
  const deduped: WebHit[] = [];
  for (const h of hits) {
    const url = h.url.trim();
    if (!url || seen.has(url)) continue;
    if (!h.snippet || h.snippet.length < 30) continue;
    seen.add(url);
    deduped.push({ ...h, url });
  }
  return deduped.slice(0, maxResults);
}

async function enrichWithFirecrawl(
  hits: WebHit[],
  signal?: AbortSignal
): Promise<{ hits: WebHit[]; report: WebEvidenceProviderReport }> {
  if (!hasEnv("FIRECRAWL_API_KEY")) {
    return {
      hits,
      report: {
        provider: "firecrawl",
        status: "missing-key",
        enhanced_count: 0,
        message: "FIRECRAWL_API_KEY is not configured.",
      },
    };
  }

  if (hits.length === 0) {
    return {
      hits,
      report: {
        provider: "firecrawl",
        status: "skipped",
        enhanced_count: 0,
        message: "No search hits to scrape.",
      },
    };
  }

  const targets = hits.slice(0, 3);
  const scrapedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    targets.map((hit) => firecrawlScrape({ url: hit.url, signal }))
  );

  if (
    signal?.aborted ||
    settled.some((r) => r.status === "rejected" && isAbortError(r.reason))
  ) {
    return {
      hits,
      report: {
        provider: "firecrawl",
        status: "timeout",
        enhanced_count: 0,
        message: "Page scraping timed out; search snippets were used instead.",
      },
    };
  }

  const markdownByUrl = new Map<string, string>();
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value?.markdown) return;
    const markdown = result.value.markdown.replace(/\s+/g, " ").trim();
    if (markdown.length < 80) return;
    markdownByUrl.set(targets[index].url, markdown.slice(0, 1200));
  });

  let enhanced = 0;
  const enriched = hits.map((hit) => {
    const markdown = markdownByUrl.get(hit.url);
    if (!markdown || markdown.length <= hit.snippet.length) return hit;
    enhanced += 1;
    return {
      ...hit,
      snippet: markdown,
      scraped_at: scrapedAt,
      evidence_level: "page-scrape" as const,
    };
  });

  return {
    hits: enriched,
    report: {
      provider: "firecrawl",
      status: "ok",
      enhanced_count: enhanced,
      message:
        enhanced > 0
          ? `Scraped ${enhanced} top result pages for stronger evidence.`
          : "Search snippets were sufficient; no page content was added.",
    },
  };
}

function sourceCounts(
  hits: WebHit[],
  providerReports: WebEvidenceProviderReport[]
): WebSearchResult["source_counts"] {
  const counts: WebSearchResult["source_counts"] = {};
  for (const hit of hits) {
    counts[hit.source] = (counts[hit.source] ?? 0) + 1;
  }
  const firecrawl = providerReports.find((r) => r.provider === "firecrawl");
  if (firecrawl?.enhanced_count) counts.firecrawl = firecrawl.enhanced_count;
  return counts;
}

function freshnessNote(args: {
  searchedAt: string;
  hits: WebHit[];
  reports: WebEvidenceProviderReport[];
}): string {
  const searchProviders = args.reports.filter((r) => r.provider !== "firecrawl");
  const usableProviders = searchProviders
    .filter((r) => r.status === "ok")
    .map((r) => r.provider)
    .join(" + ");
  const dated = args.hits.filter((h) => h.published_at).length;
  const scraped =
    args.reports.find((r) => r.provider === "firecrawl")?.enhanced_count ?? 0;

  if (args.hits.length === 0) {
    const missingAll = searchProviders.every((r) => r.status === "missing-key");
    return missingAll
      ? "No live web providers are configured, so this run relied on the curated dataset."
      : `Live web search ran at ${args.searchedAt}, but no usable Thai-source hits came back.`;
  }

  return `Live web search ran at ${args.searchedAt} via ${
    usableProviders || "configured providers"
  }: ${args.hits.length} usable hits, ${dated} dated, ${scraped} page-scraped.`;
}

/**
 * Run Tavily + Exa in parallel, dedupe by URL, take the highest-quality snippets.
 * Bounded by an overall AbortSignal so a flaky provider can't stall the agent.
 */
export async function realtimeThaiSearch(args: {
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<WebSearchResult> {
  const maxResults = args.maxResults ?? 8;
  const searchedAt = new Date().toISOString();
  const results = await Promise.all([
    runProvider("tavily", "TAVILY_API_KEY", () =>
      tavilySearch({
        query: args.query,
        maxResults,
        signal: args.signal,
      })
    ),
    runProvider("exa", "EXA_API_KEY", () =>
      exaSearch({
        query: args.query,
        maxResults,
        signal: args.signal,
      })
    ),
  ]);

  const searchHits = dedupeHits(
    results.flatMap((r) => r.hits),
    maxResults
  );
  const firecrawl = await enrichWithFirecrawl(searchHits, args.signal);
  const reports = [...results.map((r) => r.report), firecrawl.report];

  return {
    query: args.query,
    searched_at: searchedAt,
    hits: firecrawl.hits,
    provider_statuses: reports,
    source_counts: sourceCounts(firecrawl.hits, reports),
    freshness_note: freshnessNote({
      searchedAt,
      hits: firecrawl.hits,
      reports,
    }),
  };
}

export async function luxuryWellnessSearch(args: {
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<{
  hits: WebHit[];
  status: "ok" | "missing-key" | "timeout" | "error";
  message?: string;
  searched_at: string;
}> {
  const searchedAt = new Date().toISOString();
  const maxResults = args.maxResults ?? 5;

  if (!hasEnv("TAVILY_API_KEY") && !hasEnv("EXA_API_KEY")) {
    return {
      hits: [],
      status: "missing-key",
      message: "Neither TAVILY_API_KEY nor EXA_API_KEY is configured.",
      searched_at: searchedAt,
    };
  }

  try {
    const results = await Promise.all([
      hasEnv("TAVILY_API_KEY")
        ? tavilySearch({
            query: args.query,
            maxResults,
            includeDomains: LUXURY_TRAVEL_DOMAINS,
            signal: args.signal,
          }).catch(() => [] as WebHit[])
        : Promise.resolve([] as WebHit[]),
      hasEnv("EXA_API_KEY")
        ? exaSearch({
            query: args.query,
            maxResults,
            includeDomains: LUXURY_TRAVEL_DOMAINS,
            signal: args.signal,
          }).catch(() => [] as WebHit[])
        : Promise.resolve([] as WebHit[]),
    ]);

    const hits = dedupeHits(results.flat(), maxResults);
    if (args.signal?.aborted) {
      return {
        hits,
        status: "timeout",
        message: "Luxury wellness search aborted by timeout.",
        searched_at: searchedAt,
      };
    }
    return { hits, status: "ok", searched_at: searchedAt };
  } catch (err) {
    return {
      hits: [],
      status: isAbortError(err) ? "timeout" : "error",
      message:
        err instanceof Error ? err.message : "Luxury wellness search failed.",
      searched_at: searchedAt,
    };
  }
}

export async function combinedThaiSearch(args: {
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<WebHit[]> {
  return (await realtimeThaiSearch(args)).hits;
}
