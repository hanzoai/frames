# Setup and providers — credential, cascade, forcing a provider

## Setup — one credential

Everything remote goes through `api.hanzo.ai` on a Hanzo IAM token. Read it from
Hanzo KMS (`kms.hanzo.ai`) and export it; there is no credential file and no
per-repo `.env`.

```bash
export HANZO_API_KEY=...   # an IAM token, or an sk- cloud key
export HANZO_ORG=...       # the tenant that owns the shared media bucket
```

A publishable `pk-` key is read-only and the media routes refuse it. Verify the
whole setup before resolving anything:

```bash
node <SKILL_DIR>/scripts/resolve.mjs --doctor
```

To run against a Hanzo Engine on your own machine instead of the cloud, point
`HANZO_BASE_URL` at it. The endpoint moves; nothing else changes.

## Providers

Two rungs, everywhere they both apply: look in the shared catalog first, make it
when the catalog cannot answer.

| Type      | Provider / path                                                              |
| --------- | ---------------------------------------------------------------------------- |
| bgm       | `media/bgm/` in the shared catalog, then `POST /v1/audio/music`              |
| sfx       | the 21 bundled files, then `media/sfx/`, then `POST /v1/audio/foley`         |
| image     | `media/image/` in the shared catalog, then `POST /v1/images/generations`     |
| icon      | `media/icon/` in the shared catalog                                          |
| voice     | `POST /v1/audio/speech`; word timings from `POST /v1/audio/transcriptions`   |
| video     | `POST /v1/videos/generations`                                                |
| logo      | svgl, then simple-icons, then the GitHub org avatar, then the domain favicon |
| grade/lut | local core-preset map, the `params` look index, deterministic `buildCube`    |

The catalog is a listing, not an index: an object key IS its description, so a
file named `calm-cinematic-underscore.mp3` answers "calm cinematic underscore".
**The catalog is empty until it is stocked.** An empty prefix says so — bgm and
image fall through to generation, icon reports the shelf is bare.

Cost rule (X4): the agent confirms before an agent-initiated generating call; a
user-requested one just runs. Catalog reads are metered per storage operation,
generation per model call, so the generating rungs are marked `paid`.

To pin one rung (e.g. a user says "generate it, don't search"), pass
`--provider hanzo`; to stay on the shelf, `--provider catalog`. `--local-only`
skips every network provider, leaving the project and global caches plus the
bundled SFX library and the local grade/LUT builders.

## What must be installed

Only `ffmpeg`/`ffprobe` are strictly required for the tool to run at all.

| Tool               | Serves                                                           | Install                                |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------- |
| `ffmpeg`/`ffprobe` | adopt probing, smart-grade signalstats, cut, duck bake, loudnorm | system package (`brew install ffmpeg`) |

Everything else is a network call to `api.hanzo.ai` — no per-provider CLI, no
per-provider key, nothing to keep up to date on the machine.
