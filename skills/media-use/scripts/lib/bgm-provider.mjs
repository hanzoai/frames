import { asResult, compose, find } from "./catalog.mjs";

export const bgmProvider = {
  async search(intent) {
    const hit = await find("bgm", intent);
    if (!hit || hit.empty) return null;
    return asResult(hit, intent, "bgm");
  },
  async generate(intent, ctx) {
    return compose(intent, { kind: "bgm", seconds: ctx?.seconds });
  },
};
