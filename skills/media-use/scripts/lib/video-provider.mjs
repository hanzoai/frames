import { tmpdir } from "node:os";
import { join } from "node:path";
import { save, video } from "./api.mjs";

export async function videoGenerate(intent, ctx) {
  const url = await video({ prompt: intent, seconds: ctx?.seconds });
  const out = join(tmpdir(), `media-use-video-${process.pid}-${Date.now()}.mp4`);
  await save(url, out);
  return {
    localPath: out,
    ext: ".mp4",
    source: "generated",
    metadata: {
      description: intent,
      provider: "hanzo.video",
      provenance: { prompt: intent, ...(Number.isFinite(ctx?.seconds) ? { seconds: ctx.seconds } : {}) },
    },
  };
}
