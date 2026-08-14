---
name: frames-cli
description: >
  Use the Frames CLI development loop: init, add, catalog, capture, lint, check, snapshot,
  compare, grade-compare, preview, play, present, beats, keyframes, single or batch render, publish,
  cloud, cloudrun, feedback, lambda, doctor, browser, info, upgrade, skills, compositions, docs,
  benchmark, telemetry, transcribe, auth, tts, and remove-background. Also use when diagnosing build
  or render failures. validate, inspect, and layout are deprecated aliases; use check. Covers local,
  hosted cloud, AWS Lambda, and Google Cloud Run rendering.
---

# Frames CLI

Run commands as `npx @hanzo/frame ...` unless project instructions provide a wrapper. Obey the wrapper when present. The CLI requires Node.js 22 or newer and FFmpeg.

## Development loop

1. **Scaffold:** `npx @hanzo/frame init <project>` or capture a site. In non-TTY mode, pass `--non-interactive --example=<name>`.
2. **Author:** write the composition using `/frames-core`.
3. **Get fast feedback while editing:** run `npx @hanzo/frame lint` after the first HTML pass and after structural changes.
4. **Run the final gate:** run `npx @hanzo/frame check`; it reruns lint before opening the browser. Do not prepend a redundant standalone lint invocation. Add `--snapshots` for annotated overview frames and finding crops.
5. **Inspect sub-compositions:** when `index.html` mounts `data-composition-src`, capture midpoint snapshots and inspect each mounted scene.
6. **Open the final Studio preview:** run `npx @hanzo/frame preview`, hand the timeline project URL to the user, and ask whether to revise or render.
7. **Render only after approval:** use draft quality for iteration and high quality for delivery.
8. **Verify the output:** confirm the file exists, is non-empty, and has a plausible duration.

```bash
# Fast iteration check; repeat while authoring as needed.
npx @hanzo/frame lint

# Required final gate; includes lint.
npx @hanzo/frame check
npx @hanzo/frame preview
npx @hanzo/frame render --quality high --output out.mp4
test -s out.mp4
ffprobe -v error -show_format out.mp4
```

`check` runs lint first, then uses one browser session and one seek pass to audit runtime errors, failed requests, layout, `*.motion.json` assertions, and WCAG contrast. Persistent findings gate the exit code; transient entrance or exit findings are informational. Use `--strict` to gate warnings. `validate`, `inspect`, and `layout` remain aliases for compatibility but must not appear in new instructions or scripts.

## Two different preview surfaces

Do not confuse these states:

| Surface                   | When it may open                                       | Purpose                                                                           |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Storyboard board          | Before composition checks, only when `storyboard: yes` | Review plan cards and wireframe sketches. Open `?view=storyboard#project/<name>`. |
| Final composition preview | After `check` passes                                   | Review the assembled timeline before render. Open `#project/<name>`.              |

The early board is not approval of the final video. Rendering always requires the final approval defined by `frames-core/references/review-loop.md`.

## Sub-composition smoke test

Static audits cannot catch every mount failure. When the project uses sub-compositions, capture at least one visible midpoint for each host slot:

```bash
npx @hanzo/frame snapshot --at <t1>,<t2>,<t3>
```

Treat tiny unstyled content, canvas-sized icons, missing hero elements, or timeline-registration timeouts as render-blocking mount defects. See `frames-core/references/sub-compositions.md` for the corresponding fixes.

## Agent conventions

- Prefer `--json` for agent and CI calls. Server-mode `render`, `preview`, and `play` do not provide ordinary JSON output; `preview --selection --json` and `preview --context --json` are query-mode exceptions.
- `doctor --json` always exits zero. Gate on its payload:

  ```bash
  npx @hanzo/frame doctor --json | jq -e '.ok' >/dev/null
  ```

- Non-TTY mode is automatic. `init` requires `--example` there; use `--non-interactive` to force deterministic behavior on a TTY.
- Use one `FRAMES_RUN_ID` for all commands in the same verification loop.
- Use `--strict`, `--strict-all`, and `--strict-variables` when the corresponding warnings, variables, or CI conditions must gate the render.
- JSON paths redact the home directory as `$HOME`; do not try to reverse the redaction.
- When a hosted cloud project approaches or exceeds the 200 MB upload limit, use `cloud render --dry-run --json` and follow the `.framesignore` investigation in `references/cloud.md`. Never ignore an asset merely because it is large.
- Never render merely because checks pass. Pause at the final preview and wait for approval.

## Studio-directed edits

When the user refers to “this element” or the current selection, query Studio instead of guessing:

```bash
npx @hanzo/frame preview --context --json --context-fields selection
```

Use `selection.target.hfId` when available, otherwise its selector and source file. If the result reports `no-selection`, ask the user to click the element and rerun. Request only the context slices you need; use `--context-detail full` only for computed styles or editable text metadata. Full behavior and failure codes live in `references/preview-render.md`.

## Render choices

| Need                                     | Command                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Fast local iteration                     | `npx @hanzo/frame render --quality draft`                                      |
| Final local delivery                     | `npx @hanzo/frame render --quality high --output out.mp4`                      |
| Reproducible container render            | `npx @hanzo/frame render --docker --strict --output out.mp4`                   |
| Local variable-driven batch render       | `npx @hanzo/frame render --batch rows.json --output "renders/{name}.mp4"`      |
| Hosted zero-infrastructure render        | `npx @hanzo/frame cloud render`                                                |
| Self-managed distributed AWS render      | `npx @hanzo/frame lambda render <project> --width 1920 --height 1080 --wait`   |
| Self-managed distributed GCP render      | `npx @hanzo/frame cloudrun render <project> --width 1920 --height 1080 --wait` |

Skill attribution is automatic — the examples above need no `--skill`. A project scaffolded by a workflow (`frames init --skill=<workflow>`) records its owning skill in `frames.json`, and every later render inherits it on anonymous telemetry: re-renders, `npm run render`, and `--batch` alike. Pass `--skill=<slug>` explicitly only to stamp a project that was not created through a workflow (its first render then persists it).

Use cloud rendering when the user wants hosted rendering without local Chrome, FFmpeg, or AWS. Use Lambda only when AWS ownership is a requirement. Use Cloud Run only when GCP ownership is a requirement. Read the matching reference before running any cloud path.

After verifying a successful render, send one feedback report unless telemetry is disabled or the user opted out:

```bash
npx @hanzo/frame feedback --rating <0-10> --comment "<specific result or friction>"
```

Keep clean-run feedback concise. For any bug or friction, capture a **reproduction packet** before submitting; do not send only a symptom summary. Include the rerunnable command (relative to the project directory — feedback is submitted to a public channel, so do **not** paste absolute paths, home-directory prefixes, or user/machine identifiers), expected versus actual behavior, exact error (also strip absolute paths from stack traces — keep basename + line, drop the leading directory), whether output completed/fell back/failed, workaround, and repro-project status. For a rating ≤ 7 that describes a visual defect (black frame, flicker, corrupt output, wrong frame, blank output, other visual anomaly), also include a `COMPOSITION_STRUCTURE:` block — a privacy-preserving structural anatomy (element census + attribute presence + timeline shape) so maintainers can pattern-match against known bug families without the composition ZIP. Agents auto-fill this via the composition-census helper; the human user does not fill it by hand. If the issue did not reproduce again, say so and still include the last failing command and logs. Use `--file-issue` only with consent: it publishes a minimal reproduction to a public URL. The required packet format and privacy warning live in `references/preview-render.md`.

## Read the matching reference before running a command

The following references and owning skills are mandatory command contracts, not optional background reading. Before running a command in the table, read its matching row.

| Need                                                                                   | Reference                             |
| -------------------------------------------------------------------------------------- | ------------------------------------- |
| `init`, `capture`, `skills`                                                            | `references/init-and-scaffold.md`     |
| `lint`, `check`, motion sidecars, `snapshot`                                           | `references/lint-validate-inspect.md` |
| `compare`, `grade-compare`, variable-driven `render --batch`                           | `references/compare-and-batch.md`     |
| `beats` for an existing project's Studio beat grid                                     | `references/beats.md`                 |
| `preview`, `play`, `render`, `publish`, Studio context, feedback                       | `references/preview-render.md`        |
| `doctor`, browser management                                                           | `references/doctor-browser.md`        |
| `auth`, hosted cloud rendering, and template variables                                 | `references/cloud.md`                 |
| AWS Lambda deployment and rendering                                                    | `references/lambda.md`                |
| Google Cloud Run deployment and rendering                                              | `references/cloudrun.md`              |
| `info`, `upgrade`, `compositions`, `docs`, `benchmark`, telemetry, media preprocessing | `references/upgrade-info-misc.md`     |

For composition variables, also read `/frames-core` → `references/variables-and-media.md`. For `frames add` and `frames catalog`, use `/frames-registry`. Before `frames present`, read `/slideshow`; before `frames keyframes`, read `/frames-keyframes`. For TTS, transcription, captions, or background removal choices, use `/media-use`.

The specialized commands are deliberately documented by their owning workflows:

```bash
npx @hanzo/frame present <project-dir> --port 3004 --no-open
npx @hanzo/frame beats <project-dir> --json
npx @hanzo/frame keyframes <project-dir> --json
```

`present` serves a navigable deck with presenter and audience synchronization. `beats` is the standalone Studio beat-grid utility defined in `references/beats.md`. `keyframes` surfaces seek-safe animation and motion-path diagnostics.
