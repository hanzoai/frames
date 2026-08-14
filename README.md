<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo/dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/logo/light.svg">
    <img alt="Frames" src="docs/logo/light.svg" width="300">
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@hanzo/frame"><img src="https://img.shields.io/npm/v/@hanzo/frame.svg?style=flat" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@hanzo/frame"><img src="https://img.shields.io/npm/dm/@hanzo/frame.svg?style=flat" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js"></a>
</p>

<p align="center"><b>Write HTML. Render video. Built for agents.</b></p>

<p align="center">
  <a href="https://frames.hanzo.ai/quickstart">Quickstart</a> |
  <a href="https://frames.hanzo.ai/showcase">Showcase</a> |
  <a href="https://frames.hanzo.ai/catalog/blocks/data-chart">Catalog</a> |
  <a href="https://frames.hanzo.ai/introduction">Docs</a> |
  <a href="https://git.hanzo.ai/hanzoai/frames/issues">Issues</a>
</p>

<p align="center">
  <img src="docs/public/images/frames-logo-motion-1280-trimmed.webp" alt="Frames demo: HTML code on the left transforms into a rendered video on the right" width="800">
</p>

Frames is an open-source framework for turning HTML, CSS, media, and seekable animations into deterministic MP4 videos. Use it locally with the CLI, from AI coding agents with skills, or as the rendering core behind hosted authoring workflows.

## Quick Start

### With an AI coding agent

Install the Frames skills, then describe the video you want:

```bash
npx skills add hanzoai/frames --full-depth
```

> The picker opens with nothing pre-selected — the **Core Skills** group is all you need: the `/frames` router installs each creation workflow on demand. Agents and non-interactive runs should use `npx @hanzo/frame skills update` instead — it installs exactly the core set, whereas a non-interactive `skills add` without `--skill` installs all 19.
>
> `--full-depth` does a full clone of the repo's current `main`. Without it, `skills add` fetches the skills.sh registry blob, which lags `main` by hours — you'd get an older copy of a skill. (`frames skills update` already installs full-depth.)

Try a prompt like:

> Using `/frames`, create a 10-second product intro with a fade-in title, a background video, and subtle background music.

The skills teach agents the Frames production loop: plan the video, write valid HTML, wire seekable animations, add media, lint, preview, and render. They work with Claude Code, Cursor, Gemini CLI, Codex, and other coding agents that support skills.

## Skills

Frames ships 19 skills agents load on demand. Read `/frames` first — it's the router and capability map; it picks a workflow for any "make me a…" request — video, deck, or composition port — and points to the domain skills below.

Default to the **core set** — the router installs each creation workflow on demand. `npx @hanzo/frame skills update` installs exactly that from anywhere; the interactive picker (`npx skills add hanzoai/frames --full-depth`) lists it as the "Core Skills" group, nothing pre-selected. The picker is interactive-only — a non-interactive or agent run without `--skill` installs all 19. Use `npx skills add hanzoai/frames --all --full-depth` to install all 19 deliberately (skips the picker), or `npx skills add hanzoai/frames --skill <name> --full-depth` for just one (bare name, no leading `/`). Keep `--full-depth` — it installs the current `main`; without it `skills add` fetches the skills.sh blob, which lags by hours.

Installs stay lean after that: `npx @hanzo/frame init` keeps the **core set** fresh (the router, the `frames-*` domain skills, and `media-use` — plus whatever is already installed; `/figma` stays on demand) and never expands a partial install; the creation workflows install **on demand** — the router runs `npx @hanzo/frame skills update <workflow>` before entering one. Nothing re-pulls the full set behind your back.

### Upload to Codex

Build the upload-ready Codex plugin archive from the committed `HEAD` version of the manifest, brand assets, and skills:

```bash
bun run package:codex-plugin
```

This writes `dist/frames-plugin.zip` with a `frames/` root folder and fails if the archive exceeds Codex's 100 MB upload limit.

### Router

| Skill     | Use when                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/frames` | **Read first** for any request to make / create / edit / animate / render a video, animation, or motion graphic. Capability map for the domain skills, the intent layer that confirms every creation brief up front, and intent router for the creation workflows below. |

### Creation workflows

| Skill                   | Use when                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/product-launch-video` | Any **website** — marketing / launching / promoting a product (from its URL, a brief, or a script), or a site tour / showcase / social clip featuring the site's own visuals. Up to ~3 min (sweet spot 30-90s).              |
| `/faceless-explainer`   | **Explaining a topic / concept** from arbitrary text — no product, no URL, no website capture; every visual is LLM-invented (typography / abstract / diagram / data-viz).                                                    |
| `/pr-to-video`          | A **GitHub pull request** (PR URL, `owner/repo#N` ref, or "this PR") → changelog / feature-reveal / fix / refactor explainer, read via the `gh` CLI.                                                                         |
| `/embedded-captions`    | Adding **captions / subtitles** to an existing talking-head video (footage untouched) — verbatim rail, embedded climax behind the subject, or pure-cinematic embed.                                                          |
| `/talking-head-recut`   | Packaging an existing talking-head / interview / podcast video with **designed graphic overlays** — lower-thirds, data callouts, kinetic titles, pull-quotes, side panels, PiP.                                              |
| `/motion-graphics`      | A short, **unnarrated, design-led motion graphic** (~under 10s) — kinetic type, stat / chart hit, logo sting, lower-third, animated tweet / headline. MP4 or transparent overlay.                                            |
| `/music-to-video`       | A **music track** (audio file, or video to pull audio from) → a **beat-synced** video — lyric, slideshow, or kinetic promo; music drives pacing.                                                                             |
| `/slideshow`            | A **presentation / pitch deck / interactive deck** — discrete slides, fragment reveals, branching, hotspot navigation, presenter mode. Output is a navigable deck, not a rendered video.                                     |
| `/general-video`        | **Anything else** — longer or multi-scene pieces, brand / sizzle reel, title card, static loop, freeform composition. Input- and length-agnostic fallback, and the home of companion mode (co-create with the full toolbox). |
| `/remotion-to-frames`   | **Porting an existing Remotion** (React) composition's source to Frames HTML. One-way migration, not creation.                                                                                                               |

### Domain skills (loaded on demand)

Atomic capabilities the creation workflows compose against — pull one when you need that specific layer.

| Skill               | Covers                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/frames-core`      | The composition contract — `data-*` timing attributes, `class="clip"`, tracks, sub-compositions, variables, framework-owned media playback, determinism rules.                                                                                                                                                                                   |
| `/frames-animation` | All animation knowledge — atomic motion rules, scene blueprints, transitions, runtime adapters (GSAP / Lottie / Three.js / Anime.js / CSS / WAAPI / TypeGPU).                                                                                                                                                                                    |
| `/frames-keyframes` | Seek-safe keyframe authoring across runtimes — GSAP timelines, CSS keyframes, Anime.js, WAAPI, FLIP, paths, masks, SVG morph/draw, 3D depth — plus `frames keyframes` diagnostics for rendered motion.                                                                                                                                           |
| `/frames-creative`  | Non-animation creative direction — `frame.md` / `design.md`, palettes, typography, narration, beat planning, audio-reactive visuals, composition patterns.                                                                                                                                                                                       |
| `/media-use`        | The media OS — resolve any media need (BGM, SFX, image, icon, logo, voice, color grade, LUT) into a frozen local file or paste-ready block + ledger record, generate via TTS/music/image models when the catalog misses, transcribe, caption, remove backgrounds, and reuse assets across projects. One shared audio engine + manifest tracking. |
| `/frames-cli`       | CLI dev loop — `init`, `lint`, `check`, `snapshot`, `preview`, `render`, `publish`, `doctor`, plus AWS Lambda rendering (`lambda deploy / render / progress`).                                                                                                                                                                                   |
| `/frames-registry`  | Install and wire registry blocks and components into compositions via `frames add`. Authoring a new block or component to contribute upstream.                                                                                                                                                                                                   |
| `/figma`            | Import Figma assets, tokens, components, and storyboard sections → reconstructed motion (frames read as states, not slides) (REST/CLI) plus Motion animations (MCP) and shaders (MCP source / native export) into a composition.                                                                                                                 |

For visual design handoff workflows, see the [Claude Design guide](https://frames.hanzo.ai/guides/claude-design) and [Open Design guide](https://frames.hanzo.ai/guides/open-design).

### Manually with the CLI

```bash
npx @hanzo/frame init my-video
cd my-video
npx @hanzo/frame preview      # preview in browser with live reload
npx @hanzo/frame render       # render to MP4
```

**Requirements:** Node.js 22+, FFmpeg

## What You Can Build

Need ideas? Browse the [Showcase](https://frames.hanzo.ai/showcase) for finished videos you can watch, read, run, and remix.

- Product launch videos and feature announcements
- PR walkthroughs with animated code diffs, narration, and captions
- Data visualizations, chart races, and map animations
- Social videos with kinetic captions, overlays, and music
- Docs-to-video, PDF-to-video, and site-tour explainers
- Reusable motion graphics for automated content pipelines

## Frame.md

**frame.md — your design system, ready for video.**

Every brand has a `design.md`. None of them were written for a camera. `frame.md` is the missing translation layer: it takes your web-context design spec and inverts it for the frame — the same tokens, the same rules, but rewritten so an AI agent can compose a promo video without guessing at scale or reaching for web chrome.

The output is a `DESIGN.md` superset your whole toolchain can read. Atoms stay sacred. Composition stays free. Numbers come from the script.

## How It Works

Define a video as HTML. Add data attributes for timing and tracks. Use GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI, or your own frame adapter for seekable animation.

```html
<div id="stage" data-composition-id="launch" data-start="0" data-width="1920" data-height="1080">
  <video
    class="clip"
    data-start="0"
    data-duration="6"
    data-track-index="0"
    src="intro.mp4"
    muted
    playsinline
  ></video>

  <h1 id="title" class="clip" data-start="1" data-duration="4" data-track-index="1">Launch day</h1>

  <audio
    data-start="0"
    data-duration="6"
    data-track-index="2"
    data-volume="0.5"
    src="music.wav"
  ></audio>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#title", { opacity: 0, y: 40, duration: 0.8 }, 1);
    window.__timelines = window.__timelines || {};
    window.__timelines.launch = tl;
  </script>
</div>
```

Preview instantly in the browser. Render locally or in Docker. The renderer seeks each frame in headless Chrome and encodes the result with FFmpeg, so the same input produces the same video.

## Frames Stack

Frames is the open-source rendering engine, plus a growing set of tools around HTML-native video creation.

| Piece                    | Status              | What it does                                                                                    |
| ------------------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| CLI                      | Available           | Scaffold, preview, lint, inspect, and render local video projects                               |
| Core / Engine / Producer | Available           | Parse compositions, drive headless Chrome, encode video, and mix audio                          |
| Catalog                  | Available           | Reusable blocks and components for transitions, overlays, captions, charts, maps, and effects   |
| Agent skills             | Available           | Teach coding agents the video-production patterns that generic web docs miss                    |
| Studio                   | Available, evolving | Browser surface for previewing and editing compositions                                         |
| AWS Lambda rendering     | Available           | Deploy a distributed render stack and drive renders from your laptop or CI                      |
| frame.md                 | Available           | Invert your design system for the camera — a DESIGN.md superset an agent can compose video from |

## Catalog

Install ready-to-use blocks and components:

```bash
npx @hanzo/frame add flash-through-white   # shader transition
npx @hanzo/frame add instagram-follow      # social overlay
npx @hanzo/frame add data-chart            # animated chart
```

Browse the catalog at [frames.hanzo.ai/catalog](https://frames.hanzo.ai/catalog/blocks/data-chart).

## Why Frames?

- **HTML-native:** compositions are HTML files with data attributes. No React requirement, no proprietary timeline format.
- **Agent-friendly:** agents already write HTML, and the CLI is non-interactive by default.
- **Deterministic:** same input, same frames, same output. Built for CI, regression tests, and automated rendering.
- **No build step:** an `index.html` composition plays as-is and can be previewed directly in the browser.
- **Adapter-based animation:** bring GSAP, CSS animations, Lottie, Three.js, Anime.js, WAAPI, or a custom runtime.
- **Open source:** Apache 2.0 license, with no per-render fees or commercial-use thresholds.

## Frames vs Remotion

Frames is inspired by [Remotion](https://www.remotion.dev). Both tools render video with headless Chrome and FFmpeg. The main difference is the authoring model: Remotion's bet is React components; Frames' bet is plain HTML that humans and agents can both write easily.

|                          | **Frames**                            | **Remotion**                            |
| ------------------------ | ------------------------------------- | --------------------------------------- |
| Authoring                | HTML + CSS + seekable animation       | React components                        |
| Build step               | None; `index.html` plays as-is        | Bundler required                        |
| Agent handoff            | Plain HTML files                      | JSX / React project                     |
| Library-clock animations | Seekable, frame-accurate via adapters | Wall-clock animation patterns need care |
| Distributed rendering    | Local and AWS Lambda render paths     | Remotion Lambda, mature cloud renderer  |
| License                  | Apache 2.0                            | Source-available Remotion License       |

Read the full comparison in the [Frames vs Remotion guide](https://frames.hanzo.ai/guides/frames-vs-remotion).

## Documentation

Full documentation: [frames.hanzo.ai/introduction](https://frames.hanzo.ai/introduction)

- [Quickstart](https://frames.hanzo.ai/quickstart)
- [Showcase](https://frames.hanzo.ai/showcase)
- [Guides](https://frames.hanzo.ai/guides/gsap-animation)
- [API Reference](https://frames.hanzo.ai/packages/core)
- [Catalog](https://frames.hanzo.ai/catalog/blocks/data-chart)
- [Examples](https://frames.hanzo.ai/examples)
- [AWS Lambda rendering](https://frames.hanzo.ai/deploy/aws-lambda)

## Packages

| Package                                                     | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| [`@hanzo/frame`](packages/cli)                              | CLI for creating, previewing, linting, and rendering compositions |
| [`@frames/core`](packages/core)                             | Types, parsers, generators, linter, runtime, and frame adapters   |
| [`@frames/engine`](packages/engine)                         | Seekable page-to-video capture engine using Puppeteer and FFmpeg  |
| [`@frames/producer`](packages/producer)                     | Full rendering pipeline for capture, encode, and audio mix        |
| [`@frames/studio`](packages/studio)                         | Browser-based composition editor UI                               |
| [`@frames/player`](packages/player)                         | Embeddable `<frames-player>` web component                        |
| [`@frames/shader-transitions`](packages/shader-transitions) | WebGL shader transitions for compositions                         |
| [`@frames/aws-lambda`](packages/aws-lambda)                 | AWS Lambda SDK and deployment surface for distributed renders     |

## Community

Frames is developed at [Hanzo AI](https://hanzo.ai), with community examples from teams like [tldraw](https://tldraw.com), [TanStack](https://tanstack.com), and others in [ADOPTERS.md](ADOPTERS.md). Send a patch if your team is using Frames.

- Questions, bugs, and feature requests: [Issues](https://git.hanzo.ai/hanzoai/frames/issues)
- Security reports: [SECURITY.md](SECURITY.md)
- Contributions: [CONTRIBUTING.md](CONTRIBUTING.md)

## Development Note

The repo uses [Git LFS](https://git-lfs.com) for golden regression-test baselines under `packages/producer/tests/**/output.mp4` (about 240 MB of `.mp4` files). If you're cloning the full repo for development, install Git LFS first:

```bash
# macOS
brew install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Windows
winget install GitHub.GitLFS

# Then, once per machine
git lfs install
```

If you only need source files, you can skip LFS content:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://git.hanzo.ai/hanzoai/frames.git
```

## License

[Apache 2.0](LICENSE)
