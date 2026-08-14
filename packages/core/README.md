# @hanzo/frame-core

Types, parsers, generators, compiler, linter, runtime, and frame adapters for the Hyperframes video framework.

## Install

```bash
npm install @hanzo/frame-core
```

> Most users don't need to install core directly — the [CLI](../cli), [producer](../producer), and [studio](../studio) packages depend on it internally.

## What's inside

| Module             | Description                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Types**          | `TimelineElement`, `CompositionSpec`, `Asset`, canvas dimensions, defaults                           |
| **Parsers**        | `parseHtml` — extract timeline elements from HTML; `parseGsapScript` — parse GSAP animations         |
| **Generators**     | `generateHyperframesHtml` — produce valid Hyperframes HTML from a composition spec                   |
| **Compiler**       | `compileTimingAttrs` — resolve `data-start` / `data-duration` into absolute times                    |
| **Linter**         | `lintHyperframeHtml` — validate Hyperframes HTML (missing attributes, overlapping tracks, etc.)      |
| **Runtime**        | IIFE script injected into the browser — manages seek, media playback, and the `window.__hf` protocol |
| **Frame Adapters** | Pluggable animation drivers (GSAP, Lottie, CSS, or custom)                                           |

## Frame Adapters

A frame adapter tells the engine how to seek your animation to a specific frame:

```typescript
import { createGSAPFrameAdapter } from "@hanzo/frame-core";

const adapter = createGSAPFrameAdapter({
  getTimeline: () => gsap.timeline(),
  compositionId: "my-video",
});
```

Implement `FrameAdapter` for custom animation runtimes:

```typescript
import type { FrameAdapter } from "@hanzo/frame-core";

const myAdapter: FrameAdapter = {
  id: "my-adapter",
  getDurationFrames: () => 300,
  seekFrame: (frame) => {
    /* seek your animation */
  },
};
```

## Parsing and generating HTML

```typescript
import { parseHtml, generateHyperframesHtml } from "@hanzo/frame-core";

const { elements, metadata } = parseHtml(htmlString);
const html = generateHyperframesHtml(spec);
```

## Linting

```typescript
import { lintHyperframeHtml } from "@hanzo/frame-core/lint";

const result = lintHyperframeHtml(htmlString);
// result.findings: { severity, message, elementId }[]
```

## Documentation

Full documentation: [frames.hanzo.ai/packages/core](https://frames.hanzo.ai/packages/core)

## Related packages

- [`@hanzo/frame-engine`](../engine) — rendering engine that drives the browser
- [`@hanzo/frame-producer`](../producer) — full render pipeline (capture + encode)
- [`frames`](../cli) — CLI
