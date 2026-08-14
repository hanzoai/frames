import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  getProviders,
  getProvider,
  listTypes,
  providerMatches,
  providerNamesFor,
  runProviders,
  runCapability,
} from "./registry.mjs";

// --- registry shape -------------------------------------------------------

test("listTypes exposes the v2 media types", () => {
  const types = listTypes();
  for (const t of [
    "bgm",
    "sfx",
    "image",
    "icon",
    "logo",
    "voice",
    "video",
    "brand",
    "grade",
    "lut",
  ]) {
    assert.ok(types.includes(t), `missing type: ${t}`);
  }
});

test("the catalog rung comes before the generating rung", () => {
  for (const t of ["bgm", "image"]) {
    const names = providerNamesFor(t);
    const cat = names.findIndex((n) => n.startsWith("catalog."));
    const gen = names.findIndex((n) => n.startsWith("hanzo."));
    assert.ok(cat >= 0, `${t} has no catalog rung`);
    assert.ok(gen < 0 || cat < gen, `${t} generates before it searches`);
  }
});

test("sanctioned providers only: catalog, hanzo, bundled sfx, design spec, logo tiers", () => {
  const allowed =
    /^catalog\.|^hanzo\.|^bundled\.sfx$|^design_spec$|^svgl$|^simple-icons$|^github\.avatar$|^favicon\.ddg$|^color_grade\.local$|^cube_lut\.local$/;
  for (const t of listTypes()) {
    for (const name of providerNamesFor(t)) {
      assert.match(name, allowed, `${t} declares an unsanctioned provider: ${name}`);
    }
  }
});

test("image cascade: the shared catalog, then generation", () => {
  assert.deepEqual(providerNamesFor("image"), ["catalog.image", "hanzo.image"]);
  const ps = getProviders("image");
  assert.ok(ps.every((p) => p.network), "every image provider reaches the API");
  assert.ok(!ps[0].paid, "a catalog read is not a model call");
  assert.ok(ps[1].paid, "generation is metered");
});

test("voice is one route, not a cascade", () => {
  assert.deepEqual(providerNamesFor("voice"), ["hanzo.voice"]);
  const [voice] = getProviders("voice");
  assert.ok(voice.network, "voice is network (skipped under --local-only)");
  assert.ok(voice.paid, "voice generation is metered");
  assert.equal(typeof voice.generate, "function");
});

test("video is one route, generate-only", () => {
  assert.deepEqual(providerNamesFor("video"), ["hanzo.video"]);
  const [video] = getProviders("video");
  assert.equal(typeof video.search, "undefined", "video has no search capability");
  assert.equal(typeof video.generate, "function");
});

test("sfx cascade: bundled library first, then the catalog, then foley", () => {
  assert.deepEqual(providerNamesFor("sfx"), ["bundled.sfx", "catalog.sfx", "hanzo.foley"]);
  const ps = getProviders("sfx");
  assert.ok(!ps[0].network, "the bundled library is kept under --local-only");
  assert.ok(ps[1].network && ps[2].network, "catalog and foley are network");
});

test("ctx.provider pins one provider", async () => {
  const providers = [
    { name: "catalog.image", network: true, search: async () => null },
    { name: "bundled.image", generate: async () => ({ hit: "bundled" }) },
    { name: "hanzo.image", network: true, generate: async () => ({ hit: "generated" }) },
  ];
  // no override: the first generate to return non-null wins
  assert.deepEqual(await runProviders(providers, "generate", "x", {}), { hit: "bundled" });
  // pinned by prefix, and by full name
  assert.deepEqual(await runProviders(providers, "generate", "x", { provider: "hanzo" }), {
    hit: "generated",
  });
  assert.deepEqual(await runProviders(providers, "generate", "x", { provider: "hanzo.image" }), {
    hit: "generated",
  });
  // --local-only wins even over a pinned network provider: no network call,
  // clean miss (the caller surfaces the conflict). A pinned LOCAL provider under
  // --local-only still runs.
  assert.equal(
    await runProviders(providers, "generate", "x", { provider: "hanzo", localOnly: true }),
    null,
  );
  assert.deepEqual(
    await runProviders(providers, "generate", "x", { provider: "bundled", localOnly: true }),
    { hit: "bundled" },
  );
});

test("getProvider returns the first provider with its type, throws for unknown", () => {
  const p = getProvider("bgm");
  assert.equal(p.type, "bgm");
  assert.equal(typeof p.search, "function");
  assert.throws(() => getProvider("unknown_type"), /unknown media type/);
});

test("getProviders throws for unknown type", () => {
  assert.throws(() => getProviders("nope"), /unknown media type/);
});

// --- deterministic capability execution (runProviders core) ---------------

test("runProviders calls providers in order and returns the first non-null", async () => {
  const calls = [];
  const providers = [
    {
      name: "a",
      enabled: true,
      search: async () => {
        calls.push("a");
        return null;
      },
    },
    {
      name: "b",
      enabled: true,
      search: async () => {
        calls.push("b");
        return { hit: "b" };
      },
    },
    {
      name: "c",
      enabled: true,
      search: async () => {
        calls.push("c");
        return { hit: "c" };
      },
    },
  ];
  const res = await runProviders(providers, "search", "x", {});
  assert.deepEqual(res, { hit: "b" });
  assert.deepEqual(calls, ["a", "b"], "must stop at first non-null, never call c");
});

test("runProviders skips providers missing the requested capability", async () => {
  const providers = [
    { name: "a", enabled: true /* no search */ },
    { name: "b", enabled: true, search: async () => ({ hit: "b" }) },
  ];
  const res = await runProviders(providers, "search", "x", {});
  assert.deepEqual(res, { hit: "b" });
});

test("runProviders returns null when no provider yields a result", async () => {
  const providers = [{ name: "a", enabled: true, search: async () => null }];
  assert.equal(await runProviders(providers, "search", "x", {}), null);
});

test("runCapability('bgm','process') is null — process slot is graceful when unfilled", async () => {
  assert.equal(await runCapability("bgm", "process", "x", {}), null);
});

test("--local-only skips every network provider", async () => {
  let remoteRan = false;
  const providers = [
    {
      name: "remote",
      network: true,
      search: async () => {
        remoteRan = true;
        return { hit: "net" };
      },
    },
    { name: "local", search: async () => ({ hit: "local" }) },
  ];
  assert.deepEqual(await runProviders(providers, "search", "x", { localOnly: true }), {
    hit: "local",
  });
  assert.equal(remoteRan, false, "the remote provider must not be called offline");
});
