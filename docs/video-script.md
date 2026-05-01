# Hidden Siam — 5-min Demo Video Script

**Format**: Screen recording with voice-over. Light hospitality-style UI. Speak slowly and clearly — judges may not be native English speakers either.

**Cadence target**: ~120 words/min in English → ~600 words for 5 minutes. This script is ~620 words.

**Tools**: Loom or QuickTime for the recording, then a 30-second intro/outro card if you want polish (Canva).

---

## [0:00–0:25] Hook

> *(Show: a still or short clip of a packed Maya Bay or a tour-bus rush at Damnoen Saduak.)*

"In 2018, Thailand's most famous beach — Maya Bay — had to be **closed for four years**. Five thousand tourists a day had killed the reef.

The cruel irony? When you ask any AI travel assistant — ChatGPT, Gemini, you name it — for a Thailand trip, it sends you straight to Maya Bay. To Phi Phi. To Khao San Road.

We thought we could do better."

## [0:25–1:00] Problem framing

> *(Show: a quick split-screen — left, the home page of Hidden Siam; right, ChatGPT giving a generic Thailand itinerary recommending Phi Phi.)*

"Thailand has thousands of authentic destinations local Thai travelers love. They're documented in Thai-language blogs, Pantip threads, government sustainability programs. But they don't make it into general-purpose AIs because the data lives in places those models barely index.

So we built **Hidden Siam** — a multi-agent system trained on that local data, designed *against* over-tourism."

## [1:00–3:30] Live demo

> *(Switch to the running app. Type the style prompt slowly so it's readable.)*

"I'll type only a travel style: *Peaceful beaches, no party scene, good seafood, five days.* I don't need to know a Thai province yet."

> *(Hit submit. Destination picker loads.)*

"First, Hidden Siam scouts a few trip clusters. This is important for foreign travellers: if you don't know Nan from Trang from Trat, the product should orient you before asking for a destination.

I'll choose one of these cleaner, less-crowded clusters."

> *(Click "Plan this trip". Discover page loads. Highlight each agent card as it activates.)*

"Now the **eight specialized agents** collaborate, and you can see them work live.

The **Local Listener** scans our curated dataset of 91 hand-verified Thai destinations across all 77 provinces and surfaces candidates that match the selected cluster.

**At the same time, in parallel**, the **Web Pulse** agent fires off a live search to Tavily and Exa across Thai travel sources — Pantip, chillpainai, readme.me — and returns fresh 2026 mentions, validating which of our gems are still authentic and quietly flagging any that have become overrun. *That* is our edge: curated data plus today's web.

The **Crowd Analyst** reads my preference — *hate crowds* — and keeps only candidates with a low crowd-level. It flags Chiang Mai's Old City temple-circuit because that's where mass-tourism funnels go.

The **Cultural Curator** then scores what's left against my vibe — and gives a small bonus to gems the Web Pulse agent saw freshly recommended.

The **Route Planner** picks the final three gems and builds a sensible three-day plan, with a title and morning/afternoon/evening for each day.

Weather Watcher checks the forecast, Wellness Pulse adds Thai-character spa or retreat options when relevant, and the **Verifier** does the last sanity check — seasons, etiquette, holiday overlap, and local tips."

> *(Final result panel renders: map with pins, gem cards, day-by-day plan, live source links at the bottom.)*

"That's the result. Authentic spots, a real route, day-by-day plan, tourist traps avoided, live Thai-source evidence, and optional Thai wellness picks. No Phi Phi recommendation in sight."

## [3:30–4:20] Compare with ChatGPT

> *(Side-by-side: same style prompt typed into ChatGPT or Gemini.)*

"For comparison, here's the same style prompt to a general-purpose AI. It usually jumps straight to famous islands or broad province lists without explaining crowd pressure.

Hidden Siam first helps you choose a better region, then routes you around specific lower-pressure places. That's the difference between a model that knows Thailand from English Wikipedia and a product curated around how people actually travel here."

## [4:20–4:45] How it's built

> *(Quick architecture diagram or just code snippets.)*

"Under the hood: Next.js 16, Vercel AI SDK, Gemini 3.1 Flash Lite for the Destination Scout and all eight agents — kept lightweight on purpose so the flow stays demo-friendly. Tavily and Exa power the live web search; Firecrawl is wired up for deep-scrapes when needed. Server-Sent Events stream every itinerary agent step in real-time. The curated data is JSON — no database — sourced from Thai travel blogs, Pantip, readme.me, DASTA, and TAT enrichment."

## [4:45–5:00] Closing

"It's free. It's open source. The code link is in the description. And every booking diverted from Maya Bay to Koh Yao Noi is a quiet win for the country. Thank you."

---

## Recording tips

- **Practice the full Home → Destinations → Discover path 5 times** before recording. Fluency on screen matters more than fancy editing.
- **Pre-warm the dev server** with one dummy prompt right before recording, so the model isn't cold when you do the real run.
- **Have a fallback recording**: if the live demo fails during the take, use the seed dataset to fake it. Judges tolerate "here's what it looked like in our test run yesterday" — they don't tolerate dead air.
- Speak ~10% slower than you would naturally. English-as-second-language judges will thank you.
- Final volume: voice-over loud enough to hear over a laptop fan.
