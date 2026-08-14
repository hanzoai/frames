# Sound effects (SFX)

Named sound effects, produced by the shared audio engine (`scripts/audio.mjs` ->
`scripts/lib/sfx.mjs`). Each cue is resolved in the same order, cheapest first:

- **library** — the 21 files bundled with this skill (`assets/sfx/` +
  `manifest.json`). Offline, deterministic, free, and the same bytes every run.
- **catalog** — `media/sfx/` in the shared catalog, for the long tail the 21
  miss.
- **foley** — `POST /v1/audio/foley` when neither has it.

A cue nothing can answer is **skipped** and recorded as an anomaly; SFX never
blocks a render.

## Cues — request to meta

Each line names the effects it wants: `lines[].sfx: ["whoosh", "ui click"]`. The
engine flattens these into cues, resolves them, dedupes identical `(id, name)`
pairs (the same effect named twice resolves once), and writes `audio_meta.sfx[]`:

```jsonc
{
  "id": "3",                       // joins the cue to the caller's model (frame / scene / segment)
  "name": "whoosh",
  "file": "assets/sfx/whoosh.mp3", // relative to project root
  "source": "library" | "catalog" | "foley",
  "offset_s": 0,                   // delay from the line's start
  "duration_s": 0.57,
  "volume": 0.35                   // SFX sit UNDER voice + BGM
}
```

## The bundled library

21 curated files in `assets/sfx/`, indexed by `manifest.json` —
`{ file, duration, description }` per key (`whoosh`, `pop`, `click`, `chime`,
`riser`, `impact-bass-1`, `glitch-1`, `typing`, …). A cue name resolves by
**manifest key, file basename, or slug**, so `whoosh`, `whoosh.mp3`, and
`"ui click"` all land. Matched files are copied into the project's
`assets/sfx/`; `duration_s` comes from the manifest, so timing is known
**offline** — `riser` is 10.03s, so it fires at `climax - 10.03s`. The manifest's
`description` carries placement hints; read `assets/sfx/manifest.json` for the
full set.

## The catalog and foley rungs

Same catalog as BGM, under `media/sfx/`: a key IS its description, and an empty
prefix says so rather than reading as a bad query. When the shelf cannot answer,
`POST /v1/audio/foley` makes the effect from the cue name.

Name effects concretely — `glass shatter`, not `dramatic sound`. A vague name is
a vague match on the shelf and a vague prompt at the foley route.

## Rules

- **Volume 0.35.** SFX sit under narration and BGM, not against them.
- **No match, no failure.** A missing effect logs an anomaly and moves on.
- **One asset per distinct name.** Reuse across lines is deduped to a single
  resolve, many cues.
- **Cheapest rung first.** The bundled 21 cost nothing and never change; reach
  past them only for what they do not have.
