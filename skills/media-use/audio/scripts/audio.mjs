#!/usr/bin/env node
// audio.mjs — the shared Frames audio engine. ONE implementation of TTS +
// BGM + SFX for every video workflow (product-launch, general-video, pr-to-video,
// …). Workflows do NOT vendor a copy: they write a neutral `audio_request.json`
// (a tiny per-workflow adapter maps their storyboard/scenes into it) and call:
//
//   node <MEDIA_DIR>/scripts/audio.mjs --request ./audio_request.json --frames . --out ./audio_meta.json
//
// All three capabilities go through api.hanzo.ai — one credential, one host:
//
//   TTS : POST /v1/audio/speech, then /v1/audio/transcriptions for word timings
//   BGM : media/bgm/ in our object store, else POST /v1/audio/music
//   SFX : the 21 bundled files, else media/sfx/, else POST /v1/audio/foley
//
// ── audio_request.json (input) ────────────────────────────────────────────────
//   {
//     "lang": "en", "speed": 1.0,
//     "voice": null,               // a voice id the speech service accepts
//     "lines": [                   // one TTS unit each; id joins back to the caller's model
//       { "id": "01", "text": "...", "sfx": ["whoosh", "ui click"] }
//     ],
//     "bgm": { "mode": "catalog",  // catalog|compose|none (override: --bgm-mode / --no-bgm)
//              "query": "calm cinematic underscore",   // mood, and the catalog query
//              "prompt": null,      // full prompt for compose (else inferred)
//              "blob": "...", "archetype": "...", "arc": "..." }  // optional mood-inference hints
//   }
//
// ── audio_meta.json (output, id-keyed) ───────────────────────────────────────
//   { voice_id,
//     bgm: { path, volume, mode, query?, duration_s? } | null, bgm_mode,
//     voices: [ { id, path, duration_s, words: [{id,text,start,end}] } ],
//     sfx:    [ { id, name, file, source, offset_s, duration_s, volume } ],
//     total_duration_s }
//
// --only tts,bgm,sfx  runs a subset and MERGES into an existing --out (so a
// workflow can do TTS+BGM early, then SFX later once cues exist).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { align, ffprobeDuration, ready, synthesize, withWordIds } from "./lib/tts.mjs";
import { fromCatalog, fromPrompt, inferBgmPrompt } from "./lib/bgm.mjs";
import { resolveSfx } from "./lib/sfx.mjs";
import { mapWithConcurrency } from "./lib/concurrency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);
const die = (m) => {
  console.error(`✗ audio engine: ${m}`);
  process.exit(1);
};
const r3 = (x) => Number(x.toFixed(3));

// Each line is two requests (speech, then alignment), so an unbounded
// Promise.all over a long script opens two connections per line at once and
// gets throttled — the whole batch then fails together rather than degrading.
// mapWithConcurrency caps how many run at once: still parallel, just bounded.
const ttsConcurrency = Math.max(1, Number(process.env.FRAMES_TTS_CONCURRENCY) || 4);

const framesDir = resolve(flag("frames", "."));
const requestPath = resolve(flag("request", join(framesDir, "audio_request.json")));
const outPath = resolve(flag("out", join(framesDir, "audio_meta.json")));
const sfxLibDir = resolve(flag("sfx-lib", join(HERE, "..", "assets", "sfx")));
const onlyArg = flag("only", "tts,bgm,sfx");
const only = new Set(
  onlyArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const bgmModeOverride = flag("bgm-mode", null);
const noBgm = has("no-bgm");
const voiceOverride = flag("voice", null);
const speedOverride = flag("speed", null);
const langOverride = flag("lang", null);

if (!existsSync(requestPath)) die(`audio_request.json not found at ${requestPath}`);
let request;
try {
  request = JSON.parse(readFileSync(requestPath, "utf8"));
} catch (e) {
  die(`audio_request.json parse: ${e.message}`);
}
const lines = Array.isArray(request.lines) ? request.lines : [];
const lang = langOverride || request.lang || "en";
const speed = Number(speedOverride ?? request.speed ?? 1.0) || 1.0;

// ── credential (the single switch) ────────────────────────────────────────────
const online = ready();
if (!online)
  console.error(
    "· no HANZO_API_KEY — voice and generated audio are unavailable; bundled SFX still resolve",
  );

// ── merge base: preserve sections not selected by --only ──────────────────────
const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
const anomalies = [];

// ── TTS ───────────────────────────────────────────────────────────────────────
let voices = prev.voices ?? [];
let voiceId = prev.voice_id ?? null;
if (only.has("tts") && lines.length) {
  if (!online) die("voice needs a Hanzo credential — export HANZO_API_KEY");
  // No voice id means the speech service picks its own default. Pass one to
  // choose; there is no second catalog here to keep in step with theirs.
  voiceId = voiceOverride || request.voice || null;
  console.error(`· tts: ${voiceId ?? "service default"} voice · ${lines.length} line(s)`);
  const synthLine = async (line) => {
    const id = String(line.id);
    const text = String(line.text ?? "").trim();
    if (!text) {
      anomalies.push(`line ${id}: empty text — skipped`);
      return null;
    }
    const rel = `assets/voice/${id}.wav`;
    const abs = join(framesDir, rel);
    const { ok, error } = await synthesize({ text, voice: voiceId, lang, speed, out: abs });
    if (!ok) {
      anomalies.push(`line ${id}: TTS failed — omitted${error ? ` (${error})` : ""}`);
      return null;
    }
    const dur = ffprobeDuration(abs);
    if (!isFinite(dur) || dur <= 0) {
      anomalies.push(`line ${id}: bad voice duration — omitted`);
      return null;
    }
    const words = await align({ file: abs, lang });
    if (!words) anomalies.push(`line ${id}: no word timings returned — captions fall back to line timing`);
    return { id, path: rel, duration_s: r3(dur), words: withWordIds(words) };
  };
  const results = await mapWithConcurrency(lines, ttsConcurrency, synthLine);
  voices = results.filter(Boolean);
  for (const v of voices)
    console.error(`  voice ${v.id}: ${v.path} (${v.duration_s}s, ${v.words.length} words)`);
}
const hasVoice = voices.length > 0;
const totalDuration = r3(voices.reduce((a, v) => a + (v.duration_s || 0), 0));

// ── BGM ─────────────────────────────────────────────────────────────────────
let bgm = prev.bgm ?? null;
let bgmMode = prev.bgm_mode ?? null;
if (only.has("bgm")) {
  bgm = null;
  bgmMode = null;
  // An EXPLICIT mode (flag or request.bgm.mode) is honored as written: asking
  // for the catalog and getting a generated track instead is a surprise the
  // caller cannot see in the output. Only the unset default falls through.
  const explicitMode = bgmModeOverride || request.bgm?.mode || null;
  const mode = noBgm ? "none" : explicitMode || "auto";
  const query = request.bgm?.query;

  if (mode === "none" || !online) {
    if (mode !== "none") anomalies.push("bgm: needs a Hanzo credential — skipped");
    console.error(`· bgm: disabled`);
  } else {
    try {
      const hit = mode === "compose" ? null : await fromCatalog({ query, framesDir, hasVoice });
      if (hit?.path) {
        bgm = hit;
        bgmMode = "catalog";
        console.error(`  bgm: ${bgm.path} (catalog "${bgm.query}")`);
      } else if (mode === "catalog") {
        anomalies.push(
          hit?.empty
            ? `bgm: the catalog holds no music yet (${hit.prefix} is empty) — skipped`
            : `bgm: no catalog match for "${query ?? ""}" — skipped`,
        );
      } else {
        if (hit?.empty)
          anomalies.push(`bgm: the catalog holds no music yet (${hit.prefix}) — composing instead`);
        const prompt = inferBgmPrompt({
          userPrompt: request.bgm?.prompt,
          blob: request.bgm?.blob || query,
          archetype: request.bgm?.archetype,
          arc: request.bgm?.arc,
        });
        bgm = await fromPrompt({ prompt, durationS: totalDuration || 30, framesDir, hasVoice });
        bgmMode = "compose";
        console.error(`  bgm: ${bgm.path} (composed)`);
      }
    } catch (e) {
      anomalies.push(`bgm failed: ${e.message} — skipped`);
    }
  }
}

// ── SFX ─────────────────────────────────────────────────────────────────────
let sfx = prev.sfx ?? [];
if (only.has("sfx")) {
  const cues = lines.flatMap((l) =>
    (Array.isArray(l.sfx) ? l.sfx : [])
      .map((name) => ({ id: String(l.id), name: String(name).trim() }))
      .filter((c) => c.name),
  );
  const res = await resolveSfx({ cues, framesDir, sfxLibDir });
  sfx = res.sfx;
  anomalies.push(...res.anomalies);
  console.error(`· sfx: ${sfx.length} cue(s) resolved`);
}

// ── write audio_meta.json ─────────────────────────────────────────────────────
const meta = {
  voice_id: voiceId,
  bgm,
  bgm_mode: bgmMode,
  voices,
  sfx,
  total_duration_s: totalDuration,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(meta, null, 2));

console.log(`✓ audio engine → ${outPath}`);
console.log(`  ran: ${[...only].join(",")}`);
console.log(
  `  voices: ${voices.length}  ·  bgm: ${bgm ? bgmMode : "none"}  ·  sfx: ${sfx.length}`,
);
console.log(`  total voice duration: ${totalDuration}s`);
if (anomalies.length) {
  console.log(`\nanomalies (non-fatal):`);
  for (const a of anomalies) console.log(`  - ${a}`);
}
