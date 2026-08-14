# Audio engine — voiceover, music, SFX, captions, transcription

For a full audio pass (TTS voiceover + background music + sound effects in one
shot), use the shared engine at `audio/scripts/audio.mjs`. It takes a neutral
`audio_request.json` and writes `audio_meta.json` plus assets under
`.media/audio/{voice,bgm,sfx}`:

```bash
node <SKILL_DIR>/audio/scripts/audio.mjs --request ./audio_request.json --out ./audio_meta.json
```

- **Request** `{ lang?, speed?, voice?, lines: [{ id, text, sfx?: [names] }], bgm: { mode?, query?, prompt? } }`: `id` joins each line back to your model; `bgm.mode` = `catalog | compose | none` (omit for auto). `--only tts,bgm,sfx` runs a subset and merges into an existing `--out`.
- **Output** `audio_meta.json` (id-keyed): `voices[].{path,duration_s,words[]}` (word timestamps for captions), `sfx[]`, `bgm`, `total_duration_s`.
- **One credential**: `$HANZO_API_KEY` (and `$HANZO_ORG` for the shared catalog) unlocks voice, music, foley, and catalog reads. Run `node <SKILL_DIR>/scripts/resolve.mjs --doctor` before assuming any of them will work.
- Every route is synchronous: when the engine returns, every file it reports is on disk.

Single-shot helper: `audio/scripts/speak.mjs` (one line, one file, optional word timings). Per-topic guides live in `audio/references/` (`tts.md`, `bgm.md`, `sfx.md`, `transcribe.md`, `remove-background.md`, `captions/`).

Word timings come from `scripts/transcribe.mjs` -> `POST /v1/audio/transcriptions`. When the service returns text without per-word timings, the word array is empty and the engine records an anomaly; captions then fall back to line timing. Nothing is interpolated.
