# Project27Worker

Three.js worlds for [Project27], written by Claude Code on the Mac, pulled by
the iPad app straight from this repo's `main` branch.

- `worlds/` — the worlds themselves, one ES module each, plus `index.json`,
  the manifest the app reads.
- `CLAUDE.md` — the contract Claude Code writes against. Start there.
- `tools/check.sh` — syntax check, run before every commit.
- `runtime-reference/` — read-only copies of the app-side runtime a world is
  handed, so a scene-writing session never has to guess the API.

Commits push themselves (a `post-commit` hook runs `git push`), so the iPad
sees a world seconds after Claude Code finishes it: open the app → worlds menu
→ **Worlds from GitHub** → pull latest.
