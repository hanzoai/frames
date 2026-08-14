# Text to speech

One route: `POST /v1/audio/speech` through `api.hanzo.ai`. Word timings come
from a second call, `POST /v1/audio/transcriptions`, over the audio that was
just rendered.

```bash
# one line, one file
node <SKILL_DIR>/audio/scripts/speak.mjs "Welcome to Frames." -o narration.wav

# with word timings for captions
node <SKILL_DIR>/audio/scripts/speak.mjs ./script.txt \
  -o narration.wav --words narration.words.json

# another language, a chosen voice
node <SKILL_DIR>/audio/scripts/speak.mjs "Bonjour" -o fr.wav --lang fr --voice <id>
```

For a whole script — every line, plus music and effects — use the audio engine
(`audio/scripts/audio.mjs`) instead; `speak.mjs` is the single-line door onto the
same code.

## Flags

- **`--voice <id>`** — a voice the speech service accepts. Omit it and the
  service picks its own default. media-use keeps no second voice catalog to
  drift out of step with theirs.
- **`--output` / `-o`** — `.wav` is transcoded to 44.1k mono through ffmpeg (what
  `ffprobe` and the captions pipeline expect); any other extension keeps the
  service's own bytes.
- **`--words <path>`** — runs the transcription pass and writes the flat
  `[{id,text,start,end}]` shape the captions pipeline reads.
- **`--speed`** — 0.7-0.8 for tutorials and accessibility, 1.0 natural, 1.1-1.2
  for intros and upbeat pieces. Past 1.5 rarely survives a listen.
- **`--lang <code>`** — anything but `en` is sent as the request language.

## Word timings

`--words` writes the same shape `transcribe` produces, drop-in for captions:

```json
[
  { "id": "w0", "text": "Hi", "start": 0.0, "end": 0.21 },
  { "id": "w1", "text": "there", "start": 0.22, "end": 0.55 }
]
```

**When the service returns no per-word timings, nothing is written and the
command says so.** Timings are never interpolated from the audio duration: a
caption cut on invented boundaries looks correct and drifts against the voice.
Captions then fall back to line-level timing, which the audio engine already
records as `voices[].duration_s`.

## Limits

- A single request accepts **4096 bytes** of input. Longer scripts are written
  as lines in an `audio_request.json` and rendered one line per request by the
  engine, which is also how each line gets its own timing.
- `.wav` output needs `ffmpeg` on PATH. Ask for `.mp3` to skip the transcode.
