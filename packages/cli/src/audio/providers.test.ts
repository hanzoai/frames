import { describe, expect, it } from "vitest";
import { decideMusic, decideVoice, KOKORO_PIP, MUSICGEN_PIP } from "./providers.js";

describe("decideVoice — hanzo → kokoro order", () => {
  it("prefers Hanzo speech when a credential is present", () => {
    const r = decideVoice({ hosted: true, kokoro: true });
    expect(r.engine).toBe("hanzo");
    expect(r.ready).toBe(true);
  });

  it("falls to Kokoro when nothing is hosted", () => {
    expect(decideVoice({ hosted: false, kokoro: true }).engine).toBe("kokoro");
  });

  it("flags Kokoro as not-ready with a pip hint when deps are missing", () => {
    const r = decideVoice({ hosted: false, kokoro: false });
    expect(r.engine).toBe("kokoro");
    expect(r.ready).toBe(false);
    expect(r.setupHint).toBe(KOKORO_PIP);
  });

  it("omits the hint when Kokoro is ready", () => {
    expect(decideVoice({ hosted: false, kokoro: true }).setupHint).toBeUndefined();
  });
});

describe("decideMusic — MusicGen runs locally", () => {
  it("reports MusicGen as ready when its deps are installed", () => {
    const r = decideMusic({ musicgen: true });
    expect(r.engine).toBe("musicgen");
    expect(r.ready).toBe(true);
    expect(r.setupHint).toBeUndefined();
  });

  it("flags MusicGen as not-ready with a pip hint when deps are missing", () => {
    const r = decideMusic({ musicgen: false });
    expect(r.ready).toBe(false);
    expect(r.setupHint).toBe(MUSICGEN_PIP);
  });
});
