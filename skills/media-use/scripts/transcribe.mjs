#!/usr/bin/env node

import { existsSync, renameSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { MODEL, transcript } from "./lib/api.mjs";
import { track } from "./lib/telemetry.mjs";

// Transcription: POST /v1/audio/transcriptions through api.hanzo.ai. Emits
// { text, words: [{ text, start, end }] } for transcript-cut, captions, and the
// audio engine — the one transcript shape the rest of media-use reads.
//
// `words` is empty when the service returns no per-word timings. That is
// reported, never interpolated: captions cut on invented boundaries look right
// and drift against the audio.

const { values: args } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    out: { type: "string", short: "o" },
    model: { type: "string", default: MODEL.words },
    lang: { type: "string", default: "en" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (args.help) {
  console.log(`media-use transcribe: audio -> text + word timings

Usage:
  node transcribe.mjs --input audio.wav [--out audio.transcribe.json] [--model ${MODEL.words}] [--lang en]

Runs against api.hanzo.ai/v1/audio/transcriptions. Needs $HANZO_API_KEY.`);
  process.exit(0);
}

if (!args.input) {
  console.error("error: --input is required");
  process.exit(2);
}
const inputPath = resolve(args.input);
if (!existsSync(inputPath)) {
  console.error(`error: input not found: ${inputPath}`);
  process.exit(2);
}
const outPath = resolve(
  args.out || `${inputPath.slice(0, -extname(inputPath).length)}.transcribe.json`,
);

// Write via a sibling temp + atomic rename so a SIGKILL mid-write can't leave a
// truncated transcript at outPath (downstream reads it as valid JSON).
function atomicWrite(target, data) {
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  renameSync(tmp, target);
}

try {
  const result = await transcript({ file: inputPath, lang: args.lang, model: args.model });
  atomicWrite(outPath, JSON.stringify(result, null, 2));
  if (args.json) {
    console.log(JSON.stringify({ ok: true, out: outPath, words: result.words.length }));
  } else {
    console.log(
      `transcribed ${basename(inputPath)} -> ${outPath} (${result.words.length} words, ${args.model})`,
    );
    if (!result.words.length) {
      console.error("note: the service returned text without word timings");
    }
  }
  await track("media_use_transcribe", { model: args.model, words: result.words.length });
} catch (err) {
  if (args.json) console.log(JSON.stringify({ ok: false, error: err.message }));
  else console.error(`error: transcription failed: ${err.message}`);
  process.exit(1);
}
