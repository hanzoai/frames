# @hanzo/frame-studio

Browser-based composition editor UI for Hyperframes. Provides a visual timeline, code editor, and live preview for building video compositions.

## Install

```bash
npm install @hanzo/frame-studio
```

## What it does

The studio is a React application with:

- **Visual timeline** — drag, resize, and arrange elements on tracks
- **Code editor** — edit HTML and GSAP scripts with CodeMirror (syntax highlighting, autocomplete)
- **Live preview** — see changes in real time as you edit
- **Composition inspector** — view and modify element properties

## Development

The studio is embedded in the `frames preview` command. To develop the studio UI itself:

```bash
cd packages/studio
bun run dev        # Start Vite dev server
bun run build      # Build for production
bun run typecheck  # Type-check
```

## Tech stack

- React 18/19, Zustand (state management)
- CodeMirror 6 (editor)
- Tailwind CSS (styling)
- Vite (bundler)
- Phosphor Icons

## Documentation

Full documentation: [frames.hanzo.ai/packages/studio](https://frames.hanzo.ai/packages/studio)

## Related packages

- [`@hanzo/frame-core`](../core) — types and parsers used by the editor
- [`frames`](../cli) — CLI that serves the studio via `frames preview`
