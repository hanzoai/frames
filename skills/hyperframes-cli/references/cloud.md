# cloud — hosted rendering (zero-infra)

`frames cloud render` renders a composition on Hanzo Cloud. The CLI zips the project, uploads it, runs the render (Chromium + FFmpeg) there, and downloads the finished video. Nothing to deploy, and no Chrome/FFmpeg/AWS to manage; the render is metered against the org's balance.

```bash
export HANZO_API_KEY=...          # from Hanzo KMS
npx @hanzo/frame cloud render           # zip, upload, render, download
```

## When to use managed cloud, Lambda, Cloud Run, or local

- **`frames render`** (local): fastest iteration loop, use while authoring.
- **`frames cloud render`**: zero-infra. Hanzo Cloud runs the render, metered against the org's balance. This is the default answer to "render in the cloud" when you don't want to manage Chrome/FFmpeg/AWS.
- **`frames lambda render`**: bring-your-own-AWS distributed rendering with chunked parallelism. Only worth it when you've already invested in AWS (see `lambda.md`).
- **`frames cloudrun render`**: bring-your-own-GCP distributed rendering through Cloud Run and Workflows. Use only when GCP ownership is explicit (see `cloudrun.md`).

## Authentication

Cloud rendering uses the same credential as everything else: a Hanzo IAM token
in `$HANZO_API_KEY`, read from Hanzo KMS (`kms.hanzo.ai`). There is no separate
sign-in, no credential file, and no per-repo `.env` — one token, every surface.

```bash
export HANZO_API_KEY=...           # from Hanzo KMS; in CI, injected by the pipeline
npx @hanzo/frame auth status             # which credential is in use, identity, balance
                                   #   exit 0 = usable; exit 1 = absent or rejected.
                                   #   Exit 1 is the normal no-credential state
                                   #   (scripts: `auth status || echo offline`), not a
                                   #   command failure.
```

`HANZO_BASE_URL` points the CLI at a different deployment (default
`https://api.hanzo.ai`).

## The render pipeline

`cloud render` runs end-to-end:

1. **Resolve the project**: a local directory (default `.`), or skip the upload with `--asset-id` / `--url`.
2. **Auto-detect aspect ratio** from the entry HTML's `data-width`/`data-height`.
3. **Zip** the project (same ignore set as `frames publish`, including `.framesignore`).
4. **Upload** the zip through the direct-to-S3 asset flow, yielding an `asset_id`.
5. **Submit** the render, yielding a `render_id`.
6. **Poll** that render until it completes or fails (skip with `--no-wait`).
7. **Download** the signed video URL to disk.

## Archive size and `.framesignore`

The direct-upload limit is 200 MB. Frames automatically excludes root-level `renders/` and `snapshots/`, along with its existing development exclusions such as `.git`, `node_modules`, `dist`, `.next`, `coverage`, and dotfiles. Add project-specific gitignore-style rules to `<project>/.framesignore` when other generated or intermediate assets are not required at render time. The same rules affect `frames publish`.

Inspect the exact archive without authenticating, uploading, spending credits, or starting a render:

```bash
npx @hanzo/frame cloud render <project> --dry-run --json
```

The result reports compressed `size_bytes`, `file_count`, the 200 MB limit, and the ten largest included files.

When a cloud upload reports a size-limit error, agents must use this workflow:

1. Run the dry-run command and inspect the largest included files and directories.
2. Classify obvious generated outputs first: old renders, extra snapshot/contact-sheet directories, caches, exported previews, and source media used only to produce final assets.
3. Before excluding anything else, search `src`, `href`, `url()`, `data-composition-src`, JavaScript strings, manifests, and variable-driven paths across every HTML, CSS, and JavaScript entry.
4. Preserve existing `.framesignore` comments and rules. Add the narrowest verified-unneeded root-relative paths; prefer an exact directory or file over a broad wildcard.
5. Never ignore `index.html`, the selected composition, mounted sub-compositions, fonts, images, audio, video, scripts, or manifests merely because they are large. Never ignore all of `assets/`.
6. Rerun dry-run until the archive is below the limit, then run `npx @hanzo/frame check`. Remember that `check` sees the source directory, so it cannot prove a dynamically computed asset path remains in the filtered archive; the reference audit is still required.

Example:

```gitignore
# Additional generated verification passes
/snapshots2/
/snapshots3/

# Master used only to produce the final background clips
/assets/bg-pattern.mp4
```

Rules support comments, globs, and negation. A later rule can override a default, for example `!/snapshots/` when that directory intentionally contains render inputs.

## Render options

| Flag                   | Default                     | Meaning                                                                                                                        |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--fps`                | `30`                        | Frames per second, 1–240.                                                                                                      |
| `--quality`            | `standard`                  | `draft`, `standard`, or `high`.                                                                                                |
| `--format`             | `mp4`                       | `mp4`, `webm`, or `mov` (webm/mov carry alpha).                                                                                |
| `--resolution`         | `1080p`                     | `1080p` or `4k` (4k billed at 1.5×).                                                                                           |
| `--aspect-ratio`       | auto                        | `16:9`, `9:16`, or `1:1`. Auto from a local project's `data-width`/`data-height`; defaults to `16:9` for `--asset-id`/`--url`. |
| `--composition` / `-c` | `index.html`                | Entry HTML file inside the zip.                                                                                                |
| `--output` / `-o`      | `renders/<render_id>.<ext>` | Local download destination.                                                                                                    |
| `--dry-run`            | off                         | Build and inspect a local project zip without authenticating, uploading, or rendering.                                         |

```bash
npx @hanzo/frame cloud render . \
  --composition compositions/intro.html \
  --output ./renders/intro.mp4

npx @hanzo/frame cloud render --quality high --fps 60
```

`--resolution 4k` cannot combine with `--format webm`/`mov`: the 4k supersampling path has no alpha channel. Render 4k as mp4, or render alpha at native resolution.

## Templates and variables

Cloud rendering supports [composition variables](../../frames-core/references/variables-and-media.md#variables): declare `data-composition-variables` on the composition, then fill them at render time.

```bash
npx @hanzo/frame cloud render --variables '{"title":"Q4 Recap","theme":"dark"}'
npx @hanzo/frame cloud render --variables-file ./vars.json
npx @hanzo/frame cloud render --variables '{"title":"Q4 Recap"}' --strict-variables
```

For a **local project** the CLI validates `--variables` against the declared schema _before_ uploading. For `--asset-id`/`--url` the schema lives server-side, so mismatches surface as a `frames_project_invalid` API error.

**Upload once, re-render many** is the idiomatic template loop: render a local project to get its `asset_id`, then re-submit against that asset with new values (no re-zip, no re-upload).

```bash
npx @hanzo/frame cloud render ./card-template                              # note the asset_id printed on upload
npx @hanzo/frame cloud render --asset-id asst_abc123 --variables '{"name":"Ada"}'
npx @hanzo/frame cloud render --asset-id asst_abc123 --variables '{"name":"Linus"}'
```

For high-volume personalized batches, both self-managed paths provide JSONL fan-out: AWS Lambda (`lambda.md`) and Google Cloud Run (`cloudrun.md`). The full variables schema (types, declarative bindings, sub-composition overrides, precedence) lives in the `frames-core` skill.

## Fire-and-forget and webhooks

By default the CLI blocks, polls, and downloads. Combine `--no-wait` (submit and exit with just the `render_id`) with `--callback-url` (HTTPS webhook on terminal status) for true fire-and-forget:

```bash
npx @hanzo/frame cloud render --callback-url https://example.com/hf-hook --no-wait
#    Poll later with: frames cloud get hfr_def456
```

| Flag              | Meaning                                             |
| ----------------- | --------------------------------------------------- |
| `--no-wait`       | Submit and exit immediately; print the `render_id`. |
| `--callback-url`  | HTTPS webhook fired when the render terminates.     |
| `--callback-id`   | Opaque tracking ID echoed in webhook payloads.      |
| `--poll-interval` | Poll cadence in seconds (default `10`).             |
| `--max-wait`      | Max poll duration in minutes (default `60`).        |

## Managing renders

```bash
npx @hanzo/frame cloud list                 # recent renders (--limit, --token, --all)
npx @hanzo/frame cloud get hfr_def456       # full detail + short-lived signed video_url
npx @hanzo/frame cloud delete hfr_def456    # soft-delete (--no-confirm to skip the prompt)
```

`video_url` and `thumbnail_url` are short-lived presigned URLs, so re-fetch with `cloud get` rather than caching them.

## Safe retries

A retry is harmless for reads, but the zip upload is **not** idempotent: a blind retry creates a duplicate asset and meters twice. Pass `--idempotency-key` so retries are safe:

```bash
npx @hanzo/frame cloud render . --idempotency-key "$(uuidgen)"
```

The key is forwarded to both upload and submit (the server scopes idempotency per-endpoint, so reusing one value is safe). Use any opaque string in `[A-Za-z0-9_:.-]`, 1–255 chars.

Full flag reference: docs `/deploy/cloud` and `/packages/cli#frames-cloud`.
