#!/usr/bin/env node
// speak.mjs — one text in, one audio file out (plus optional word timings).
// A thin CLI over lib/tts.mjs, the same code the audio engine runs, so the
// request, the mp3->wav transcode, and the alignment pass live in one place.
//
// Usage:
//   node speak.mjs "Text to speak"  -o narration.wav [--words narration.words.json]
//   node speak.mjs ./script.txt     -o narration.wav --words narration.words.json
//   node speak.mjs "Bonjour"        -o fr.wav --lang fr --voice <id>
//
// Flags: -o/--output (.wav transcodes through ffmpeg; anything else keeps the
//   service's bytes), --words, --voice, --speed, --lang.
// Needs $HANZO_API_KEY, and ffmpeg for .wav output.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { align, ffprobeDuration, synthesize, withWordIds } from "./lib/tts.mjs";

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  if (i + 1 >= argv.length) return true;
  const v = argv[i + 1];
  return v.startsWith("--") ? true : v;
}
const die = (m) => {
  console.error(`✗ speak: ${m}`);
  process.exit(1);
};

// First arg that isn't a flag or the -o value is the text / .txt path.
const positional = (() => {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) i++;
      continue;
    }
    if (a === "-o") {
      i++;
      continue;
    }
    return a;
  }
  return null;
})();

const output = resolve(
  (typeof flag("output") === "string" && flag("output")) ||
    (argv.includes("-o") && argv[argv.indexOf("-o") + 1]) ||
    "narration.wav",
);
const wordsPath = typeof flag("words") === "string" ? resolve(flag("words")) : null;
const voice = typeof flag("voice") === "string" ? flag("voice") : null;
const speedRaw = typeof flag("speed") === "string" ? Number(flag("speed")) : 1.0;
const speed = isFinite(speedRaw) && speedRaw > 0 ? speedRaw : 1.0;
const lang = typeof flag("lang") === "string" ? flag("lang") : "en";

if (!positional) die("no text given. Pass a string or a .txt path.");
const text =
  positional.endsWith(".txt") && existsSync(resolve(positional))
    ? readFileSync(resolve(positional), "utf8").trim()
    : positional;
if (!text) die("input text is empty");

const { ok, error } = await synthesize({ text, voice, speed, lang, out: output });
if (!ok) die(error);

let wordCount = 0;
if (wordsPath) {
  const words = await align({ file: output, lang });
  if (words?.length) {
    mkdirSync(dirname(wordsPath), { recursive: true });
    writeFileSync(wordsPath, JSON.stringify(withWordIds(words), null, 2));
    wordCount = words.length;
  } else {
    console.error("⚠ the transcription returned no word timings — nothing written to --words");
  }
}

const dur = ffprobeDuration(output);
const durStr = isFinite(dur) ? ` (${dur.toFixed(2)}s)` : "";
console.log(`✓ ${output}${durStr}${wordCount ? ` · ${wordsPath} (${wordCount} words)` : ""}`);
