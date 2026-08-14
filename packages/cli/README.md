# @hanzo/frame

CLI for creating, previewing, and rendering HTML video compositions.

## Install

```bash
npm install -g @hanzo/frame
```

Or use directly with npx:

```bash
npx @hanzo/frame <command>
```

Both install the `frames` command.

**Requirements:** Node.js >= 22, FFmpeg

## Commands

### `init`

Scaffold a new Hyperframes project from a template:

```bash
npx frames init my-video
cd my-video
```

### `preview`

Start the live preview studio in your browser:

```bash
npx frames preview
# Studio running at http://localhost:3002

npx frames preview --port 4567
```

### `render`

Render a composition to MP4. Run from the project directory; the positional
argument is the project directory (not a file), so render the project's
`index.html` directly, or point at a specific composition file with `-c`:

```bash
npx frames render -o output.mp4
npx frames render -c ./my-composition.html -o output.mp4
```

### `lint`

Validate your Hyperframes HTML:

```bash
npx frames lint ./my-composition
npx frames lint ./my-composition --json      # JSON output for CI/tooling
npx frames lint ./my-composition --verbose   # Include info-level findings
```

By default only errors and warnings are shown. Use `--verbose` to also display informational findings (e.g., external script dependency notices). Use `--json` for machine-readable output with `errorCount`, `warningCount`, `infoCount`, and a `findings` array.

### `compositions`

List compositions found in the current project:

```bash
npx frames compositions
```

### `benchmark`

Run rendering benchmarks:

```bash
npx frames benchmark ./my-composition.html
```

### `doctor`

Check your environment for required dependencies (Chrome, FFmpeg, Node.js):

```bash
npx frames doctor
```

### `browser`

Manage the bundled Chrome/Chromium installation:

```bash
npx frames browser
```

### `info`

Print version and environment info:

```bash
npx frames info
```

### `docs`

Open the documentation in your browser:

```bash
npx frames docs
```

### `upgrade`

Check for updates and show upgrade instructions:

```bash
npx frames upgrade
npx frames upgrade --check --json  # machine-readable for agents
```

## Documentation

Full documentation: [frames.hanzo.ai/packages/cli](https://frames.hanzo.ai/packages/cli)

## Related packages

- [`@hanzo/frame-core`](../core) — types, parsers, frame adapters
- [`@hanzo/frame-engine`](../engine) — rendering engine
- [`@hanzo/frame-producer`](../producer) — render pipeline
- [`@hanzo/frame-studio`](../studio) — composition editor UI
