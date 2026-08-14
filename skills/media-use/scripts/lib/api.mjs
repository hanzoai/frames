// api.mjs — the one client for Hanzo's media services.
//
// Every remote call media-use makes goes through api.hanzo.ai: one host, one
// credential, one file to change. The routes used here:
//
//   POST /v1/audio/speech                    text  -> spoken audio
//   POST /v1/audio/transcriptions            audio -> text
//   POST /v1/audio/music                     prompt -> a music bed
//   POST /v1/audio/foley                     prompt -> a sound effect
//   POST /v1/images/generations              prompt -> an image
//   POST /v1/videos/generations              prompt -> a video
//   GET  /v1/s3/buckets/<b>/objects          browse the shared media catalog
//   GET  /v1/s3/buckets/<b>/objects/<key>    a short-lived link to one object
//
// Auth is a Hanzo IAM token in $HANZO_API_KEY, held in Hanzo KMS
// (kms.hanzo.ai) and handed to the process as an environment variable. There is
// no credential file and no per-repo .env. A publishable `pk-` key is read-only
// and is refused by the media routes; use an IAM token or an `sk-` key.
// Storage routes are tenant-scoped and additionally read $HANZO_ORG as X-Org-Id.

import { mkdirSync, openAsBlob, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_BASE = "https://api.hanzo.ai";

// The models behind each capability. Values, not places: change one here and
// every caller follows.
export const MODEL = {
  speech: "zen-voice",
  words: "whisper",
  music: "zen-music",
  sound: "zen-foley",
  image: "zen-image",
  video: "zen-video",
};

// The bucket holding shared media, and the prefix per media type inside it.
export const BUCKET = "media";
export const PREFIX = { bgm: "bgm/", sfx: "sfx/", image: "image/", icon: "icon/" };

export const base = () => (process.env.HANZO_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
export const key = () => process.env.HANZO_API_KEY || "";
export const org = () => process.env.HANZO_ORG || "";

/** Is a credential present? Providers ask before reaching for the network. */
export const ready = () => key() !== "";

const MISSING =
  "no Hanzo credential — export HANZO_API_KEY (read it from Hanzo KMS at kms.hanzo.ai)";

/** Auth headers, or throw naming the fix. `tenant` adds the storage org scope. */
export function auth({ tenant = false } = {}) {
  if (!ready()) throw new Error(MISSING);
  const headers = { Authorization: `Bearer ${key()}` };
  if (tenant) {
    if (!org()) throw new Error("no Hanzo org — export HANZO_ORG (the tenant that owns the media)");
    headers["X-Org-Id"] = org();
  }
  return headers;
}

async function fail(res, path) {
  const detail = await res.text().catch(() => "");
  return new Error(`${path} -> HTTP ${res.status}${detail ? `\n${detail.slice(0, 300)}` : ""}`);
}

/** JSON in, JSON out. */
export async function json(path, { method = "GET", body, tenant = false, signal } = {}) {
  const init = { method, headers: auth({ tenant }), signal };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base()}${path}`, init);
  if (!res.ok) throw await fail(res, `${method} ${path}`);
  return res.json();
}

/** JSON in, bytes out — the shape of every media-producing route. */
export async function bytes(path, body, { signal } = {}) {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await fail(res, `POST ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

/** A file plus fields in, JSON out. */
export async function form(path, fields) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.append(name, value);
  }
  const res = await fetch(`${base()}${path}`, { method: "POST", headers: auth(), body });
  if (!res.ok) throw await fail(res, `POST ${path}`);
  return res.json();
}

/** Read a URL into memory. */
export async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}: ${String(url).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Write bytes to disk, making the parent directory; returns the byte length. */
export function write(buf, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  return buf.length;
}

/** Copy a URL to disk; returns the byte length. */
export async function save(url, destPath) {
  return write(await fetchBytes(url), destPath);
}

// ── media routes ─────────────────────────────────────────────────────────────

// The speech route caps `input` at 4096 bytes; split longer scripts per line.
export const MAX_SPEECH_INPUT = 4096;

/** Speak `text`. Returns the audio bytes in `format` (mp3 unless asked). */
export function speech({ text, voice, speed = 1.0, lang, model = MODEL.speech, format = "mp3" }) {
  const body = { model, input: text, response_format: format, speed };
  if (voice) body.voice = voice;
  if (lang && lang !== "en") body.language = lang;
  return bytes("/v1/audio/speech", body);
}

/**
 * Transcribe an audio file to `{ text, words: [{ text, start, end }] }`.
 * The one source of transcripts and, when the service returns them, of word
 * timings: captions, transcript cuts, and the audio engine all read this shape.
 *
 * `words` is EMPTY unless the reply carries per-word timings. The route asks for
 * them (verbose_json + word granularity) and passes through whatever comes back;
 * it never interpolates timings the service did not measure, because a caption
 * cut on invented timings looks correct and is wrong.
 */
export async function transcript({ file, lang, model = MODEL.words }) {
  const payload = await form("/v1/audio/transcriptions", {
    file: await openAsBlob(file),
    model,
    response_format: "verbose_json",
    "timestamp_granularities[]": "word",
    language: lang && lang !== "en" ? lang : undefined,
  });
  const words = (payload.words ?? [])
    .filter((w) => w && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ text: String(w.word ?? w.text ?? "").trim(), start: w.start, end: w.end }))
    .filter((w) => w.text);
  return { text: String(payload.text ?? "").trim(), words };
}

/** Generate a music bed. */
export function music({ prompt, seconds, model = MODEL.music, format = "wav" }) {
  return audio("/v1/audio/music", { prompt, seconds, model, format });
}

/** Generate one sound effect. */
export function foley({ prompt, seconds, model = MODEL.sound, format = "wav" }) {
  return audio("/v1/audio/foley", { prompt, seconds, model, format });
}

function audio(path, { prompt, seconds, model, format }) {
  const body = { model, prompt, response_format: format };
  if (Number.isFinite(seconds)) body.duration = Math.max(1, Math.round(seconds));
  return bytes(path, body);
}

/** The first item of an OpenAI-shaped `{ data: [...] }` reply. */
export function first(payload, path) {
  const item = (payload?.data ?? [])[0];
  if (!item) throw new Error(`${path} returned no result`);
  return item;
}

/** Generate an image. Returns the image bytes. */
export async function image({ prompt, size = "1024x1024", model = MODEL.image }) {
  const path = "/v1/images/generations";
  const item = first(
    await json(path, { method: "POST", body: { model, prompt, size, n: 1 } }),
    path,
  );
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) return fetchBytes(item.url);
  throw new Error(`${path} returned neither b64_json nor url`);
}

/** Generate a video. Returns the URL of the finished clip. */
export async function video({ prompt, seconds, model = MODEL.video }) {
  const path = "/v1/videos/generations";
  const body = { model, prompt };
  if (Number.isFinite(seconds)) body.duration = Math.max(1, Math.round(seconds));
  return first(await json(path, { method: "POST", body }), path).url;
}

// ── storage ──────────────────────────────────────────────────────────────────

/**
 * One flat listing under `prefix`. Keys come back RELATIVE to the prefix and the
 * server caps a page at 1000 entries.
 */
export async function objects(prefix, { bucket = BUCKET } = {}) {
  const query = new URLSearchParams({ prefix, recursive: "true" });
  const payload = await json(`/v1/s3/buckets/${bucket}/objects?${query}`, { tenant: true });
  return (payload.objects ?? []).filter((o) => !o.isDir);
}

/**
 * A link to one object. The store hands back a signed URL that expires in
 * minutes, so fetch it now — do not write one into a document.
 */
export async function link(key, { bucket = BUCKET } = {}) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  const payload = await json(`/v1/s3/buckets/${bucket}/objects/${path}`, { tenant: true });
  return payload.url;
}
