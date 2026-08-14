# Background music (BGM)

One music bed per composition, produced by the shared audio engine
(`scripts/audio.mjs` -> `scripts/lib/bgm.mjs`). Two routes:

- **catalog** — the closest name under `media/bgm/` in the shared catalog,
  downloaded to `assets/bgm/track.<ext>`. Free, instant, identical every run.
- **compose** — `POST /v1/audio/music` with a mood prompt, written to
  `assets/bgm/track.wav`. Used when the catalog cannot answer.

Both are synchronous: when the engine returns, the file is on disk.

## Driving it from the request

`audio_request.json` -> `bgm: { mode?, query?, prompt? }`:

- **`mode`** — `catalog | compose | none`. Omit for **auto** (catalog, then
  compose). An explicit `catalog` is honored as written: an empty or unmatched
  shelf is reported and BGM is skipped, never quietly composed instead.
- **`query`** — the mood. It is the catalog query and the fallback prompt seed
  (a storyboard's `music:` field, falling back to `message` -> `arc` ->
  `"calm cinematic underscore"`).
- **`prompt`** — an explicit full prompt for compose; omit it and the engine
  infers one. Optional `blob` / `archetype` / `arc` feed that inference.

## The catalog rung

The catalog is a listing under `media/bgm/`, browsed through
`GET /v1/s3/buckets/media/objects`. **An object key IS its description** — a
file named `calm-cinematic-underscore.mp3` answers "calm cinematic underscore" —
so stock it with names written in the words a brief would use.

**The catalog is empty until someone stocks it.** That is reported, not hidden:
an empty prefix logs `the catalog holds no music yet (bgm/)` and, under auto,
falls through to compose.

The cue written to `audio_meta.json`:

```jsonc
{
  "path": "assets/bgm/track.mp3",
  "volume": 0.12,
  "mode": "catalog",
  "query": "calm cinematic underscore",
  "key": "bgm/calm-cinematic-underscore.mp3",
}
```

`volume` comes from `bgmDefaultVolume()`: `BGM_BED_VOLUME` (0.12, about -18 dB —
a bed under the voice) under narration, `BGM_SILENT_VOLUME` (0.9) for a silent
film. Tune those constants in `scripts/lib/bgm.mjs`, not at call sites. An
explicit `volume` in `audio_meta.json` always wins.

## The compose rung

`POST /v1/audio/music` with the inferred (or given) prompt and the total voice
duration. Output goes to `assets/bgm/track.wav`.

## Mood inference (the compose prompt)

`inferBgmPrompt()` in `scripts/lib/bgm.mjs`: an explicit `prompt` wins;
otherwise industry-keyword **base** -> narrative-**archetype** shape ->
emotional-**arc** tiebreaker.

| Match in `blob` / `query`                              | Base prompt                                                                 | BPM |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | --- |
| `crypto / nft / web3 / defi / token / blockchain`      | atmospheric electronic, deep bass, futuristic synths, restrained percussion | 100 |
| `finance / fintech / bank / payment / invest / wealth` | calm cinematic, soft strings, subtle piano, restrained percussion           | 92  |
| `creative / agency / design / studio / art / brand`    | playful electronic, warm pads, light percussion                             | 115 |
| _(default: SaaS / tech / platform)_                    | uplifting corporate tech, bright modern piano with synth pads               | 108 |

Archetype then reshapes the arc — PAS -> "MINOR to MAJOR" build; BAB /
future-pacing -> aspirational rising; feature-cascade -> +10 BPM driving;
demo-loop -> -8 BPM minimal. The emotional arc breaks remaining ties
(tension->relief, excitement, trust/reassurance).

## Failure modes

| Failure                         | Behavior                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Empty catalog, auto mode        | Anomaly logged, composes instead.                           |
| Empty catalog, explicit catalog | Anomaly logged, `bgm: null`. Render proceeds without music. |
| No catalog match                | Same as above — reported, then composed or skipped.         |
| No credential                   | `bgm: null`, anomaly logged.                                |
| The music call fails            | `bgm: null`, anomaly names the HTTP status.                 |

BGM failure never blocks a render.
