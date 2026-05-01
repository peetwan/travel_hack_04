@AGENTS.md

## Notes for Claude Code

- **No test suite** — no `npm test` to run. Verification = `npx tsc --noEmit` + `npx next build` for type/build, plus a real browser run for UI changes.
- **Live preview verification.** When you change anything in `app/page.tsx`, `app/discover/page.tsx`, `components/`, or `app/globals.css`, run a real fetch against `localhost:3001` (or whichever port Next picked) and confirm the change with a screenshot. Static review of CSS classes is not enough — Tailwind v4 plus CSS variables are easy to mis-type.
- **Plan mode is overkill** for small tweaks. Use it for cross-file refactors (e.g. "redesign all gem cards") or new agents, not for prompt-tuning or single-file UI fixes.
- **Hardcoded keys are a hard no** — even temporarily, even in scripts, even in commit messages. The `.env*` gitignore is the only line of defence.
- **The prompt language is the product.** When tuning agents, treat `lib/agents/prompts.ts` as the most important file. A schema change is mechanical; a prompt change moves user-visible quality.
