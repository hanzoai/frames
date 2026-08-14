// bgm.mjs — background music for the media audio engine. Two routes, one
// switch, both ours:
//
//   catalog   look under media/bgm/ in our object store and take the closest
//             name. Free, instant, and the same track every run.
//   compose   POST /v1/audio/music with a mood prompt when the catalog has
//             nothing that fits.
//
// The catalog is empty until someone fills it, and that is reported plainly
// rather than papered over: an empty prefix falls through to compose, and an
// explicit `catalog` request says the shelf is bare instead of quietly
// generating something the caller did not ask for.
//
// Missing or failed BGM never blocks a render.

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { compose, find } from "../../../scripts/lib/catalog.mjs";
import { save } from "../../../scripts/lib/api.mjs";

const r3 = (x) => Number(x.toFixed(3));

// Default BGM level. Under narration music is a bed that must stay under the
// voice — 0.12 linear is about -18 dB. A silent film (no voice) has no voice to
// duck beneath, so BGM sits forward at 0.9. Callers may override per composition.
export const BGM_BED_VOLUME = 0.12;
export const BGM_SILENT_VOLUME = 0.9;
export const bgmDefaultVolume = (hasVoice) => (hasVoice ? BGM_BED_VOLUME : BGM_SILENT_VOLUME);

/** Take the closest catalog track. Returns null on a miss, `{ empty }` on a bare shelf. */
export async function fromCatalog({ query, framesDir, hasVoice }) {
  const q = query || "calm cinematic underscore";
  const hit = await find("bgm", q);
  if (!hit || hit.empty) return hit;
  const rel = `assets/bgm/track${extOf(hit.key)}`;
  await save(hit.url, join(framesDir, rel));
  return {
    path: rel,
    volume: bgmDefaultVolume(hasVoice),
    query: q,
    mode: "catalog",
    key: hit.prefix + hit.key,
    duration_s: null,
  };
}

/** Generate a bed for the whole piece. */
export async function fromPrompt({ prompt, durationS, framesDir, hasVoice }) {
  const rel = "assets/bgm/track.wav";
  const made = await compose(prompt, { kind: "bgm", seconds: Math.max(1, durationS) });
  const dest = join(framesDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(made.localPath, dest);
  rmSync(made.localPath, { force: true });
  return {
    path: rel,
    volume: bgmDefaultVolume(hasVoice),
    query: prompt,
    mode: "compose",
    duration_s: r3(Math.max(1, durationS)),
  };
}

const extOf = (key) => (/\.\w+$/.exec(key) ?? [".mp3"])[0];

// ── mood inference (for the compose prompt) ──────────────────────────────────
// Industry base -> archetype shape -> emotional-arc tiebreaker. Exported so a
// workflow adapter can build a rich prompt from its own narrative metadata; the
// engine also calls it when compose has only a plain mood query.
export function inferBgmPrompt({ blob = "", archetype = "", arc = "", userPrompt = "" } = {}) {
  if (userPrompt) return userPrompt;
  const b = String(blob).toLowerCase();
  let base;
  let bpm;
  if (/\b(crypto|nft|web3|defi|token|blockchain|exchange|wallet|dao)\b/.test(b)) {
    base = "atmospheric electronic, deep bass, futuristic synths, restrained percussion";
    bpm = 100;
  } else if (/\b(finance|fintech|bank|payment|invest|wealth|insurance|treasury)\b/.test(b)) {
    base = "calm cinematic, soft strings, subtle piano, restrained percussion";
    bpm = 92;
  } else if (/\b(creative|agency|design|studio|art|brand|marketing|content)\b/.test(b)) {
    base = "playful electronic, warm pads, light percussion";
    bpm = 115;
  } else {
    base = "uplifting corporate tech, bright modern piano with synth pads";
    bpm = 108;
  }
  const at = String(archetype).toLowerCase();
  const ar = String(arc).toLowerCase();
  if (/\bpas\b|pain.agitate|pain.+solve/.test(at))
    return `${base}, starts with subtle tension then builds to resolution, BPM ${bpm}, transitions from MINOR to MAJOR`;
  if (/\bbab\b|before.after|future.pac|vision/.test(at))
    return `${base}, cinematic and aspirational, steady build with rising energy, BPM ${bpm}, MAJOR`;
  if (/cascade|feature.benefit/.test(at))
    return `${base}, energetic and driving, consistent momentum, BPM ${Math.min(bpm + 10, 128)}, MAJOR`;
  if (/demo.loop|question.+answer/.test(at))
    return `${base}, clean and focused, minimal arrangement, BPM ${Math.max(bpm - 8, 88)}`;
  if (/frustrat|anxiety|overwhelm|tension/.test(ar) && /relief|excite|triumph/.test(ar))
    return `${base}, builds from understated tension to uplifting resolution, BPM ${bpm}, MINOR to MAJOR`;
  if (/excit|awe|power|triumph/.test(ar)) return `${base}, energetic and confident, BPM ${bpm}, MAJOR`;
  if (/trust|ease|clarity|reassur/.test(ar))
    return `${base}, warm and reassuring, BPM ${Math.max(bpm - 5, 85)}`;
  return `${base}, BPM ${bpm}, MAJOR`;
}
