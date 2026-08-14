# Media operations: agent guidance

media-use resolves and remembers assets. For **operating** on them: cutting,
reframing, stitching, transforming, it does not wrap every action as a bespoke
command. Instead it points you at the right local tool (decision OP1). Run the
tool, then register the output with `resolve --from <output> --type <type>` so the
result lands in the ledger and the global cache like any other asset.

All tools below are local and free. ffmpeg is assumed present (it backs the
engine already).

## Cut / trim: keep a slice

```bash
ffmpeg -i in.mp4 -ss 00:00:12 -to 00:00:20 -c copy out.mp4   # 0:12–0:20, no re-encode
```

In-composition trimming usually needs **no new file**: a clip plays a sub-window
via `data-media-start` + `data-duration` (see frames-core). Only cut a
physical file when exporting/assembling outside the composition.

## Reframe / crop: change aspect ratio

```bash
# 16:9 -> 9:16, crop centered
ffmpeg -i in.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" out.mp4
```

For a non-destructive crop, set a `clip-path` on the element in the composition
itself (render-time, source file untouched) instead of re-encoding with ffmpeg.

## Montage / stitch: join clips

```bash
printf "file '%s'\n" a.mp4 b.mp4 c.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4
```

## Silence-cut / highlight: trim dead air, grab the best moment

```bash
auto-editor in.mp4 --edit audio:threshold=4% -o tight.mp4   # pip install auto-editor
scenedetect -i in.mp4 detect-adaptive list-scenes           # pip install scenedetect
```

## Transforms that run on this machine (process)

| Op                 | Command                                            |
| ------------------ | -------------------------------------------------- |
| Background removal | `hanzo frame remove-background in.png` (u2net)     |
| Upscale            | `realesrgan-ncnn-vulkan -i in.png -o out.png -s 4` |

After any op: `resolve --from out.ext --type <type>` to register the derived
asset (it records provenance and auto-promotes to the global cache).

> media-use does not re-wrap ffmpeg here, and that is deliberate (OP1). The
> value it adds is the ledger + global reuse on the _output_, via `--from`. Add
> a thin `process` verb only if agents repeatedly fumble these recipes.

## Exact error-diffusion dither

Use the local processor when the requested look specifically calls for
Floyd-Steinberg, Atkinson/Macintosh, Jarvis-Judice-Ninke, Stucki, Burkes, or a
Sierra variant. These are sequential error-diffusion algorithms, not the
realtime Bayer `effects.dither` shader.

```bash
node <SKILL_DIR>/scripts/dither.mjs \
  --input source.mp4 \
  --out source.atkinson.mp4 \
  --algorithm atkinson \
  --palette '#0f380f,#306230,#8bac0f,#9bbc0f' \
  --point-size 3

node <SKILL_DIR>/scripts/resolve.mjs \
  --from source.atkinson.mp4 --type video --project .
```

Available algorithms: `floyd-steinberg`, `atkinson`,
`jarvis-judice-ninke`, `stucki`, `burkes`, `sierra`, `sierra-lite`, and
`two-row-sierra`. The default is balanced Floyd-Steinberg with a black/white
palette. Palettes contain 2-6 `#rrggbb` colors in authored dark-to-light order;
reversing the order intentionally inverts the mapping. `--point-size` controls
1-20px blocks; `--brightness` and `--contrast` accept 0.5-2; `--detail` accepts
0.1-1.

The processor supports ordinary SDR images and MP4 video, preserves video
audio, and emits BT.709 MP4. It rejects tagged PQ/HLG input rather than silently
tone-mapping it. To animate the transformation, keep the original and processed
files as two real media layers and use the seek-safe GSAP timeline to reveal or
crossfade between them. Use the realtime Bayer shader instead when the dither
amount itself must animate continuously.

## Transcription

`transcribe.mjs` is the one transcription path: `POST /v1/audio/transcriptions`
through `api.hanzo.ai`. It emits `{ text, words: [{text,start,end}] }`, feeding
transcript-cut, captions, and the audio engine directly.

```bash
node <SKILL_DIR>/scripts/transcribe.mjs --input talk.mp4 --out talk.transcribe.json
node <SKILL_DIR>/scripts/transcribe.mjs --input talk.mp4 --lang es
```

`--model` selects `whisper` (default) or the smaller, faster `whisper-small`.
Nothing is downloaded and nothing is built on first use.

**`words` is empty when the service returns text without per-word timings**, and
the command says so. Timings are never interpolated: a cut made on invented word
boundaries reads as correct and drifts against the audio. A caller that needs
per-word cuts should treat an empty `words` as "fall back to line timing".

## Text-based editing (transcript cut)

`transcript-cut.mjs` is a compiler, not a wrapper: it turns word timestamps and
agent cut decisions into exact kept segments. It is provided even though the rest
of this file is guidance-only.

```bash
node <SKILL_DIR>/scripts/transcript-cut.mjs \
  --input talk.mp4 \
  --transcript talk.transcribe.json \
  --remove "12.41-15.02,88.3-91.7" \
  --remove-fillers "um,uh,like" \
  --cut-silence 0.8 \
  --out talk.cut.mp4

resolve --from talk.cut.mp4 --type video
```

Use `--plan` first when you want to inspect the kept segment JSON before encoding.

## Ducking (declare in-composition / bake for export)

B1, declare ducking in the composition. `audio-duck.mjs` emits GSAP volume
keyframes. Paste them into the composition timeline, the source file stays
untouched.

```bash
node <SKILL_DIR>/scripts/audio-duck.mjs \
  --meta audio_meta.json \
  --target "#bgm" \
  --composition index.html
```

```js
// auto-duck: #bgm under narration (generated; base volume 0.6)
tl.to("#bgm", { volume: 0.15, duration: 0.15 }, 3.42);
tl.to("#bgm", { volume: 0.6, duration: 0.4 }, 9.87);
```

B2, bake ducking only for exported or standalone files.

```bash
ffmpeg -i bgm.mp3 -i voice.wav \
  -filter_complex "[0][1]sidechaincompress=threshold=0.03:ratio=8:attack=200:release=400[ducked]" \
  -map "[ducked]" bgm.ducked.wav
```

Declare inside compositions. Bake only for assets leaving the frames
pipeline.

## Publish loudness

Two-pass `loudnorm` measures first, then applies the measured values with the
target LUFS baked in.

Socials target, -14 LUFS:

```bash
ffmpeg -i mix.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json \
  -f null -

ffmpeg -i mix.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:measured_LRA=<input_lra>:measured_thresh=<input_thresh>:offset=<target_offset>:linear=true:print_format=summary \
  mix.social.wav
```

Podcast target, -16 LUFS:

```bash
ffmpeg -i mix.wav \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json \
  -f null -

ffmpeg -i mix.wav \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:measured_LRA=<input_lra>:measured_thresh=<input_thresh>:offset=<target_offset>:linear=true:print_format=summary \
  mix.podcast.wav
```

## Generate: images

`resolve --type image` looks in the shared catalog first (`media/image/`); on a
miss it generates through `POST /v1/images/generations`. Both rungs are one
credential and one host — nothing to install, no model to cache, no RAM ladder
to satisfy.

To skip the shelf and go straight to generation, pass `--provider hanzo`; to
stay on the shelf, `--provider catalog`. `--local-only` skips both and leaves
the project and global caches.

The catalog is empty until it is stocked. An empty prefix is reported as such
and image falls through to generation.

## Generate: video

`resolve --type video "<intent>"` generates through
`POST /v1/videos/generations` and freezes the result into the project ledger.
Pass `--voice-id` when the piece speaks and the default voice is wrong.

There is no catalog rung for video: a clip is made for the piece it is in, and
a shelf of generic clips is a worse answer than a fresh one. Under
`--local-only` there is no video rung at all, which resolve reports as a clean
miss rather than a silent skip.

## HEVC / H.265 sources

HEVC/H.265 sources need no conversion for **render** (FFmpeg pre-decodes all
input video) or for **preview** (auto-proxy transcodes and caches an H.264
copy on first use, disable with `--no-proxy` or `media.autoProxy: false` in
frames.json). A manual H.264 proxy via `ffmpeg -i in.mp4 -c:v libx264
-crf 18 proxy.mp4`, registered with `resolve --from`, remains available for
edge cases (e.g. auto-proxy disabled, or ffmpeg unavailable at preview time).
