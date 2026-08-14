# Voice to captions

When no recorded voiceover exists, render one and take its word timing from the
same audio.

```bash
node skills/media-use/audio/scripts/speak.mjs \
  script.txt --output narration.wav --words narration.words.json
```

`speak.mjs` renders the line through `POST /v1/audio/speech`, then reads word
timings back through `POST /v1/audio/transcriptions` over the audio it just
wrote. `narration.words.json` lands in the `[{ id, text, start, end }]` shape
the captions pipeline consumes.

Two calls, not one, because they answer two questions — a piece with no captions
never pays for the alignment pass. Aligning against the rendered audio (rather
than trusting a synthesis-time estimate) is also what keeps caption timing
matched to delivery.

## When there are no timings

If the transcription returns text without per-word timings, `--words` writes
nothing and says so. Timings are never interpolated from the audio duration: a
caption cut on invented boundaries reads as correct and drifts against the
voice. Captions then fall back to line-level timing, which the audio engine
already records as `voices[].duration_s`.

For a whole script — every line, plus music and effects, with timings folded
into `audio_meta.json` — use the audio engine rather than calling `speak.mjs`
per line. See `../../references/audio.md`.
