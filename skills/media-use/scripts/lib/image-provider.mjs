import { tmpdir } from "node:os";
import { join } from "node:path";
import { image, write } from "./api.mjs";
import { asResult, find } from "./catalog.mjs";

const catalogSearch = (kind) => async (intent) => {
  const hit = await find(kind, intent);
  if (!hit || hit.empty) return null;
  return asResult(hit, intent, kind);
};

export const imageProvider = {
  search: catalogSearch("image"),
  async generate(intent, ctx) {
    const localPath = join(tmpdir(), `media-use-image-${process.pid}-${Date.now()}.png`);
    write(await image({ prompt: intent, size: ctx?.size }), localPath);
    return {
      localPath,
      ext: ".png",
      source: "generated",
      metadata: {
        description: intent,
        provider: "hanzo.image",
        provenance: { prompt: intent, ...(ctx?.size ? { size: ctx.size } : {}) },
      },
    };
  },
};

export const iconProvider = { search: catalogSearch("icon") };
