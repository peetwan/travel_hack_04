// Lightweight clients for the three search providers we use in Web Pulse.
// Direct fetch instead of SDKs so we keep dependencies and bundle small.

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

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
  source: "tavily" | "exa" | "firecrawl";
  published_at?: string;
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

  if (!res.ok) return [];
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

  if (!res.ok) return [];
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

/**
 * Run Tavily + Exa in parallel, dedupe by URL, take the highest-quality snippets.
 * Bounded by an overall AbortSignal so a flaky provider can't stall the agent.
 */
export async function combinedThaiSearch(args: {
  query: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<WebHit[]> {
  const results = await Promise.allSettled([
    tavilySearch({ query: args.query, maxResults: args.maxResults, signal: args.signal }),
    exaSearch({ query: args.query, maxResults: args.maxResults, signal: args.signal }),
  ]);

  const hits: WebHit[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") hits.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: WebHit[] = [];
  for (const h of hits) {
    if (!h.url || seen.has(h.url)) continue;
    if (!h.snippet || h.snippet.length < 30) continue;
    seen.add(h.url);
    deduped.push(h);
  }
  return deduped.slice(0, args.maxResults ?? 8);
}
