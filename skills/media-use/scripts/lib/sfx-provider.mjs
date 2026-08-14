import { asResult, compose, find } from "./catalog.mjs";

export const sfxProvider = {
  async search(intent) {
    const hit = await find("sfx", intent);
    if (!hit || hit.empty) return null;
    return asResult(hit, intent, "sfx");
  },
  async generate(intent, ctx) {
    return compose(intent, { kind: "sfx", seconds: ctx?.seconds });
  },
};
