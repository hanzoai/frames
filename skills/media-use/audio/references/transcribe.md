# Transcription

Word-level timestamps from audio, through `POST /v1/audio/transcriptions`.

```bash
node <SKILL_DIR>/scripts/transcribe.mjs --input audio.mp3
node <SKILL_DIR>/scripts/transcribe.mjs --input video.mp4 --lang es
node <SKILL_DIR>/scripts/transcribe.mjs --input audio.mp3 --out words.json --json
```

## Language

`--lang` defaults to `en` and is sent as the request language. Pass the real
language of the audio: a transcription asked for the wrong language returns
translated text, which silently destroys the original. For mixed-language audio,
name the one you want kept.

## Model

`--model` defaults to `whisper`. `whisper-small` is the faster, smaller
alternative. Both are served by our speech service; there is nothing to download
and no first-run build.

## Output shape

A flat array of word objects. The `id` (`w0`, `w1`, …) is added during
normalization so caption overrides have a stable reference.

```json
{
  "text": "Hello world.",
  "words": [
    { "text": "Hello", "start": 0.0, "end": 0.5 },
    { "text": "world.", "start": 0.6, "end": 1.2 }
  ]
}
```

**`words` is empty when the service returns text without per-word timings**, and
the command says so on stderr. Nothing is interpolated to fill the gap. Callers
that need per-word cuts should treat an empty `words` as "captions fall back to
line timing", not as a failed transcription.

For caption-quality checks and retry rules, see
`captions/transcript-handling.md`.
