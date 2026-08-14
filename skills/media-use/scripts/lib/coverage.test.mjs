import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listTypes, getProviders } from "./registry.mjs";

// Capstone: media-use must actually OWN each frames media weakness. This
// test enforces the weakness→owner matrix in references/meta.md so a claim can't rot — if
// a capability's entrypoint disappears, this fails.

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("weakness: audio-only → media-use resolves image + icon", () => {
  for (const t of ["image", "icon"]) {
    assert.ok(getProviders(t).length > 0, `no provider for ${t}`);
  }
});

test("weakness: no third-party brand logos → media-use resolves logo", () => {
  assert.ok(listTypes().includes("logo"), "logo type missing");
  assert.ok(getProviders("logo").length >= 4, "logo cascade incomplete");
});

test("weakness: no voice/audio gen → media-use exposes voice + the audio engine", () => {
  assert.ok(listTypes().includes("voice"), "voice type missing");
  assert.ok(getProviders("voice").length > 0, "no enabled voice provider (Bin approved)");
  assert.ok(existsSync(join(SKILL, "audio", "scripts", "audio.mjs")), "audio engine missing");
});

test("weakness: scattered audio engine → consolidated under media-use (frames-media gone)", () => {
  assert.ok(existsSync(join(SKILL, "audio", "scripts", "lib", "tts.mjs")), "tts engine missing");
  assert.ok(
    existsSync(join(SKILL, "audio", "assets", "sfx", "manifest.json")),
    "bundled SFX missing",
  );
});

test("weakness: no media-ops → ops guidance reference exists", () => {
  assert.ok(existsSync(join(SKILL, "references", "operations.md")), "operations.md missing");
});

test("weakness: no transcript-driven cutting → cut compiler entrypoints exist", async () => {
  assert.ok(existsSync(join(SKILL, "scripts", "transcript-cut.mjs")), "transcript-cut missing");
  assert.ok(existsSync(join(SKILL, "scripts", "lib", "cutlist.mjs")), "cutlist lib missing");
  const cutlist = await import("./cutlist.mjs");
  assert.equal(typeof cutlist.compileCutList, "function");
});

test("weakness: no transcript → one transcription entrypoint on the one client", async () => {
  assert.ok(existsSync(join(SKILL, "scripts", "transcribe.mjs")), "transcribe.mjs missing");
  const api = await import("./api.mjs");
  assert.equal(typeof api.transcript, "function", "transcription call missing");
});

test("weakness: no auto-duck/loudness → duck compiler and recipes exist", async () => {
  assert.ok(existsSync(join(SKILL, "scripts", "audio-duck.mjs")), "audio-duck missing");
  assert.ok(existsSync(join(SKILL, "scripts", "lib", "duck.mjs")), "duck lib missing");
  assert.ok(existsSync(join(SKILL, "references", "operations.md")), "operations.md missing");
  const duck = await import("./duck.mjs");
  assert.equal(typeof duck.speechSpans, "function");
  assert.equal(typeof duck.duckKeyframes, "function");
});

test("weakness: no cross-project memory → global cache + ingest entrypoints exist", async () => {
  const cache = await import("./cache.mjs");
  assert.equal(typeof cache.cachePut, "function");
  assert.equal(typeof cache.promote, "function");
  assert.equal(typeof cache.globalMediaDir, "function");
  const freeze = await import("./freeze.mjs");
  assert.equal(typeof freeze.isDirectMediaUrl, "function", "ingest URL guard missing");
});

test("weakness: no image generation → catalog search then generation", () => {
  const ps = getProviders("image");
  assert.ok(
    ps.some((p) => p.name === "catalog.image" && typeof p.search === "function"),
    "image catalog search missing",
  );
  assert.ok(
    ps.some((p) => p.name === "hanzo.image" && typeof p.generate === "function"),
    "image generation missing",
  );
});

test("weakness: no video generation → the video type generates", () => {
  const ps = getProviders("video");
  assert.ok(
    ps.some((p) => p.name === "hanzo.video" && typeof p.generate === "function"),
    "video generation missing",
  );
  assert.ok(existsSync(join(SKILL, "references", "operations.md")), "operations.md missing");
});

test("every resolve type has at least one enabled provider", () => {
  for (const t of listTypes()) {
    assert.ok(getProviders(t).length > 0, `type ${t} has no enabled provider`);
  }
});
