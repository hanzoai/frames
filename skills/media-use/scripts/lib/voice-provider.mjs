import { MAX_SPEECH_INPUT, speech, write } from "./api.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Voiceover through the one speech route. The service owns its voice catalog;
// pass ctx.voice to choose one, omit it for the service default.
export async function ttsGenerate(intent, ctx) {
  if (Buffer.byteLength(intent, "utf8") > MAX_SPEECH_INPUT) {
    console.error(`media-use: script exceeds the ${MAX_SPEECH_INPUT}-byte speech limit — split it`);
    return null;
  }
  const out = join(tmpdir(), `media-use-voice-${process.pid}-${Date.now()}.mp3`);
  const buf = await speech({ text: intent, voice: ctx?.voice, lang: ctx?.lang, format: "mp3" });
  write(buf, out);
  return {
    localPath: out,
    ext: ".mp3",
    source: "generated",
    metadata: {
      description: intent,
      provider: "hanzo.voice",
      provenance: { prompt: intent, ...(ctx?.voice ? { voice: ctx.voice } : {}) },
    },
  };
}
