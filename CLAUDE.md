@AGENTS.md

## Notes for Claude Code

- **No test suite** — no `npm test` to run. Verification = `npx tsc --noEmit` + `npx next build`. **Stop there.** The maintainer runs the local preview themselves and verifies UI changes — see the matching rule in `AGENTS.md`. Do not call Claude Preview tools (`preview_eval`, `preview_screenshot`, `preview_snapshot`, etc.) and do not auto-navigate the dev server.
- **Plan mode is overkill** for small tweaks. Use it for cross-file refactors (e.g. "redesign all gem cards") or new agents, not for prompt-tuning or single-file UI fixes.
- **Hardcoded keys are a hard no** — even temporarily, even in scripts, even in commit messages. The `.env*` gitignore is the only line of defence.
- **The prompt language is the product.** When tuning agents, treat `lib/agents/prompts.ts` as the most important file. A schema change is mechanical; a prompt change moves user-visible quality.
