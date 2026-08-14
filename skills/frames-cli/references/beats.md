# Generate a project beat grid

Use `frames beats` when an existing Frames project needs the Studio-compatible beat file for its music track. This is a CLI utility, not a complete video workflow.

```bash
npx @hanzo/frames beats
npx @hanzo/frames beats ./my-video
npx @hanzo/frames beats ./my-video --json
```

The project must contain a local music `<audio>` source. Mark it with `data-timeline-role="music"`; an id containing `music`, `bgm`, or `soundtrack` is also recognized. The command analyzes that file in headless Chrome and writes `beats/<audio-relative-path>.json`.

If no beats are detected, the command fails and writes nothing. If Chrome is unavailable, run:

```bash
npx @hanzo/frames browser ensure
```

For a complete beat-synced video, route through `/music-to-video`. That workflow owns a different audio-driven pipeline and its `audiomap.json`; do not replace its analyzer with this Studio utility.
