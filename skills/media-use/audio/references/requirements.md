# Requirements & caches

## Credential

One credential, one host. Read it from Hanzo KMS (`kms.hanzo.ai`) and export it:

```bash
export HANZO_API_KEY=...   # a Hanzo IAM token, or an sk- cloud key
export HANZO_ORG=...       # the tenant that owns the shared media bucket
```

There is no credential file and no per-repo `.env`. A publishable `pk-` key is
read-only and the media routes refuse it. `HANZO_BASE_URL` points the same code
at a Hanzo Engine on your own machine (default `https://api.hanzo.ai`).

`node <SKILL_DIR>/scripts/resolve.mjs --doctor` reports what is set and what is
reachable.

## What each capability needs

| Capability         | Route                           | Local dependency              |
| ------------------ | ------------------------------- | ----------------------------- |
| Voice              | `POST /v1/audio/speech`         | `ffmpeg` for `.wav` output    |
| Word timings       | `POST /v1/audio/transcriptions` | none                          |
| Music              | `POST /v1/audio/music`          | none                          |
| Sound effects      | `POST /v1/audio/foley`          | none                          |
| Images             | `POST /v1/images/generations`   | none                          |
| Video              | `POST /v1/videos/generations`   | none                          |
| The shared catalog | `GET /v1/s3/buckets/media/…`    | none                          |
| Grade / LUT        | built locally from `params`     | `ffprobe` for measured grades |

No model downloads and no per-provider Python: everything but ffmpeg is an HTTP
call. `ffmpeg` and `ffprobe` are the only strict requirements
(`brew install ffmpeg`).

## Limits worth knowing

- **Speech input is capped at 4096 bytes per request.** The engine sends one
  request per line, which is also how each line gets its own duration.
- **Transcription upload is capped at 25 MiB.** Longer audio is cut first.
- **A catalog listing returns at most 1000 keys per prefix.** Treat a full page
  as "there may be more".
- **A catalog link is signed and expires in minutes.** Fetch it now; never write
  one into a document.
