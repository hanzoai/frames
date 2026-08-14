// tts.mjs — voice for the media audio engine. One route, not a cascade:
//
//   POST /v1/audio/speech          the text becomes audio
//   POST /v1/audio/transcriptions  the audio becomes text, and word timings
//                                  when the service measures them
//
// Both live behind api.hanzo.ai (see ../../../scripts/lib/api.mjs). Point
// $HANZO_BASE_URL at a local Hanzo Engine to run the same code offline — the
// endpoint moves, the code does not.
//
// Synthesis and word timings are two calls because they are two questions. The
// engine asks the first for every line and the second only when captions need
// per-word cuts, so a piece with no captions never pays for alignment.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MAX_SPEECH_INPUT, ready, speech, transcript, write } from "../../../scripts/lib/api.mjs";

export { ready };

/** Give each word a stable id so captions can key off it. */
export function withWordIds(words) {
  return (words ?? []).map((w, i) => ({ id: `w${i}`, text: w.text, start: w.start, end: w.end }));
}

// `ffmpeg -i <file>` prints a `Duration: HH:MM:SS.ms` line to stderr even
// though it exits non-zero with no output requested. Parsing pulled out as a
// pure function so the ENOENT fallback below can be tested without depending on
// whether ffprobe/ffmpeg are actually installed on the machine running tests.
export function parseFfmpegDurationBanner(stderrText) {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderrText ?? "");
  if (!match) return NaN;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// Some "essentials"-style ffmpeg distributions (common on Windows) ship
// ffmpeg.exe without ffprobe.exe. ffprobeDuration's caller (audio.mjs)
// otherwise reads a spurious NaN as "the WAV file is corrupt" and drops an
// already-synthesized line, rather than "the tool for measuring it is missing".
function ffmpegDurationFallback(absPath) {
  const r = spawnSync("ffmpeg", ["-i", absPath], { encoding: "utf8" });
  return parseFfmpegDurationBanner(r.stderr);
}

export function ffprobeDuration(absPath) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", absPath],
    { encoding: "utf8" },
  );
  if (r.error?.code === "ENOENT") return ffmpegDurationFallback(absPath);
  if (r.status !== 0) return NaN;
  return parseFloat(String(r.stdout).trim());
}

// mp3 bytes -> wav 44.1k mono at destWav (ffmpeg detects the true format).
export function toWav(buf, destWav) {
  const dir = mkdtempSync(join(tmpdir(), "media-tts-"));
  const src = join(dir, "a.mp3");
  writeFileSync(src, buf);
  mkdirSync(dirname(destWav), { recursive: true });
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", src, "-ar", "44100", "-ac", "1", destWav],
    { stdio: "ignore" },
  );
  rmSync(dir, { recursive: true, force: true });
  return ff.status === 0 && existsSync(destWav);
}

/**
 * Synthesize one line to `out`. `.wav` is transcoded to 44.1k mono (what the
 * rest of the pipeline expects); any other extension keeps the service's bytes.
 * Never throws: a failure returns `{ ok: false, error }` naming the cause, so
 * the caller can say WHY a line was dropped instead of "TTS failed".
 */
export async function synthesize({ text, voice, speed = 1.0, lang = "en", out }, deps = {}) {
  const say = deps.speech ?? speech;
  const wav = deps.toWav ?? toWav;
  if (!ready()) return { ok: false, error: "no Hanzo credential — export HANZO_API_KEY" };
  if (Buffer.byteLength(text, "utf8") > MAX_SPEECH_INPUT) {
    return { ok: false, error: `line exceeds the ${MAX_SPEECH_INPUT}-byte speech limit — split it` };
  }
  try {
    const buf = await say({ text, voice, speed, lang, format: out.endsWith(".wav") ? "wav" : "mp3" });
    if (out.endsWith(".wav")) {
      if (!wav(buf, out)) return { ok: false, error: "wav transcode failed (ffmpeg)" };
    } else {
      write(buf, out);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message ? String(e.message) : String(e) };
  }
}

/**
 * Word timings for a rendered audio file, or `null` when the service returned
 * none. Callers treat `null` as "captions fall back to line timing" — never as
 * a reason to invent word boundaries.
 */
export async function align({ file, lang = "en" }, deps = {}) {
  const read = deps.transcript ?? transcript;
  try {
    const { words } = await read({ file, lang });
    return words.length ? words : null;
  } catch {
    return null;
  }
}
