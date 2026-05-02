@AGENTS.md

## Notes for Claude Code

- **No test suite** — no `npm test` to run. Verification = `npx tsc --noEmit` + `npx next build`. **Stop there.** The maintainer runs the local preview themselves and verifies UI changes — see the matching rule in `AGENTS.md`. Do not call Claude Preview tools (`preview_eval`, `preview_screenshot`, `preview_snapshot`, etc.) and do not auto-navigate the dev server.
- **Plan mode is overkill** for small tweaks. Use it for cross-file refactors (e.g. "redesign all gem cards") or new agents, not for prompt-tuning or single-file UI fixes.
- **Hardcoded keys are a hard no** — even temporarily, even in scripts, even in commit messages. The `.env*` gitignore is the only line of defence.
- **The prompt language is the product.** When tuning agents, treat `lib/agents/prompts.ts` as the most important file. A schema change is mechanical; a prompt change moves user-visible quality.
- **Read `docs/design-flow.md` before changing the Home → Destinations → Discover journey.** Destination Scout is a pre-flow, not part of the live agent crew panel.
- **Customer copy is curated.** Don't surface internal data layers (TAT SHA / Forbes / Condé Nast / Travel + Leisure / Google Places), vendor names (Tavily / Exa / Firecrawl), agent names (Web Pulse, Verifier), or debug states ("missing-key", "editorial ok") in `/discover`, the crew panel chips, or the gem/wellness cards. The cross-validation pipeline still runs — it just doesn't appear in copy. Per-card award badges (e.g. "Forbes Travel Guide 2024" on a wellness venue) are trust signals and stay.
