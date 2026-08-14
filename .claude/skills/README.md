# Project-local Claude Code skills

Skills in this directory are auto-discovered by Claude Code when the
`frames` repo is opened as the working directory. They are NOT part of
the marketplace-distributed plugin (that set lives under `skills/` and is
manifested by `.claude-plugin/`). Two separate namespaces, on purpose:

- `.claude/skills/` — **repo-native**, run only against this repo (weekly
  changelog videos, doctrine-heavy authoring flows). Claude Code's
  project-local skill dir.
- `skills/` — **marketplace-distributable**, installed into other projects
  via `npx @hanzo/frames skills` or `npx skills add hanzoai/frames`.

## Weekly changelog video

The `changelog-video` skill turns a weekly changelog markdown into a
~45–60s branded 1080×1080 MP4 (motion-doctrine layout, one narrator,
seam-gated cuts, caption rail). It ships pre-configured — fonts,
background pattern, house BGM, lexicon, and the align-captions script all
live inside `changelog-video/`. Its five dependency skills
(`motion-doctrine`, `cut-the-curve`, `captions-overlay`, `seam-craft`,
`oversized-cursor`) sit alongside so the router graph is complete on
clone.

Weekly usage:

1. Regenerate the digest markdown for the target range:
   `bun run changelog:weekly --from YYYY-MM-DD --to YYYY-MM-DD` (this
   only reads git; the `--write` variant is what the docs cron uses).
2. In Claude Code at the repo root, invoke `/changelog-video` with the
   generated markdown. The agent will present its script + visualization
   plan for review before rendering.
3. Accept, and the agent produces `weekly-changelog-<range>.mp4` gated by
   `frames check` (0 errors) + `seam-gate verify` (0 fail/warn).

VO comes from `frames tts` and its word timings from `frames transcribe`,
both local models. Runtime dependencies you need on PATH:

- Node ≥ 22
- `ffmpeg` (for VO wav conversion + frame QA)
- A headless Chrome for Frames rendering (`frames doctor` will
  point out the exact ask if it's missing)

The parallel set at `.agents/skills/` is a byte-identical copy so Codex
CLI users get the same auto-discover behaviour — keep the two in sync
when editing. A `scripts/check-skill-mirror.mjs` check enforces this at
CI time.
