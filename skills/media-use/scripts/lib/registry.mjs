// Provider registry — the v2 contract.
//
// Each media type maps to an ORDERED list of provider entries. Providers are
// tried in order; the first to return a non-null result wins, which keeps
// resolution deterministic (same request -> same provider -> same file ->
// reproducible renders).
//
// An entry exposes any of three capability methods — search / generate /
// process — plus { name }. Everything remote goes through api.hanzo.ai on one
// credential ($HANZO_API_KEY, from Hanzo KMS), so a type's cascade is: look in
// the shared catalog first, make it if the catalog cannot answer.
//
//   catalog.*   files under media/<type>/ in our object store — free, instant,
//               and byte-identical run to run
//   hanzo.*     the generating routes: /v1/audio/{speech,music,foley},
//               /v1/images/generations, /v1/videos/generations
//   bundled.sfx the 21 sound effects shipped inside this skill
//   svgl … favicon  public brand marks, for the `logo` type only
//
// `ctx.provider` forces one provider (e.g. "resolve this bgm from the catalog").

import { bgmProvider } from "./bgm-provider.mjs";
import { sfxProvider } from "./sfx-provider.mjs";
import { bundledSfxProvider } from "./bundled-sfx-provider.mjs";
import { imageProvider, iconProvider } from "./image-provider.mjs";
import { brandProvider } from "./brand-provider.mjs";
import {
  svglSearch,
  simpleIconsSearch,
  githubAvatarSearch,
  faviconSearch,
} from "./logo-provider.mjs";
import { ttsGenerate } from "./voice-provider.mjs";
import { videoGenerate } from "./video-provider.mjs";

// Provider markers: `network` = reaches api.hanzo.ai (skipped by --local-only).
// `paid` = metered against the org's balance, which is documentation for the
// agent's cost judgment (X4: agent-initiated paid should confirm). Catalog reads
// are metered per storage operation; generation is metered per model call.
const A = (name, caps) => ({ name, ...caps }); // on this machine, free
const N = (name, caps) => ({ name, network: true, ...caps }); // remote, free
const P = (name, caps) => ({ name, network: true, paid: true, ...caps }); // remote, metered

// Catalog before generation, everywhere it applies. All remote providers are
// skipped by --local-only.
const REGISTRY = {
  bgm: [
    N("catalog.bgm", { search: bgmProvider.search }),
    P("hanzo.music", { generate: bgmProvider.generate }),
  ],
  sfx: [
    A("bundled.sfx", { search: bundledSfxProvider.search }),
    N("catalog.sfx", { search: sfxProvider.search }),
    P("hanzo.foley", { generate: sfxProvider.generate }),
  ],
  image: [
    N("catalog.image", { search: imageProvider.search }),
    P("hanzo.image", { generate: imageProvider.generate }),
  ],
  icon: [N("catalog.icon", { search: iconProvider.search })],
  logo: [
    // Official brand marks, from the sources that publish them. Tiers verified
    // by a 54-brand stress test (100% cascade hit). All free, all network, so
    // --local-only leaves only the cache rungs.
    N("svgl", { search: svglSearch }),
    N("simple-icons", { search: simpleIconsSearch }),
    N("github.avatar", { search: githubAvatarSearch }),
    N("favicon.ddg", { search: faviconSearch }),
  ],
  voice: [P("hanzo.voice", { generate: ttsGenerate })],
  video: [P("hanzo.video", { generate: videoGenerate })],
  brand: [
    // Local design spec — reads frame.md / design.md tokens.
    A("design_spec", { search: brandProvider.search }),
  ],
  grade: [
    // Local deterministic cascade handled by resolve.mjs so grade records can
    // carry an inline block as well as an optional frozen .cube file.
    A("color_grade.local", { search: async () => null, generate: async () => null }),
  ],
  lut: [
    // Lower-level local LUT generation/freezing path handled by resolve.mjs.
    A("cube_lut.local", { search: async () => null, generate: async () => null }),
  ],
};

function listFor(type) {
  const list = REGISTRY[type];
  if (!list) throw new Error(`unknown media type: ${type}`);
  return list;
}

/** Ordered providers for a type. */
export function getProviders(type) {
  return listFor(type);
}

/** All declared media types. */
export function listTypes() {
  return Object.keys(REGISTRY);
}

/** Provider names available for a type, in cascade order (for --provider validation). */
export function providerNamesFor(type) {
  return listFor(type).map((p) => p.name);
}

/**
 * Does an override token (a full name like "catalog.bgm" or a prefix like
 * "catalog") match any provider declared for the type? Same match rule as
 * runProviders, so validation and dispatch never disagree.
 */
export function providerMatches(type, want) {
  return providerNamesFor(type).some((n) => n === want || n.startsWith(`${want}.`));
}

/** The first declared provider for a type, tagged with `type`. */
export function getProvider(type) {
  const first = listFor(type)[0] || {};
  return { ...first, type };
}

/**
 * Run a capability across an explicit ordered provider list. Tries each in
 * order, returns the first non-null result, skips providers that don't expose
 * the capability. Pure over its input — the unit-testable core of the cascade.
 *
 * Offline guard: a `network` provider is skipped when `ctx.localOnly` is set —
 * unconditionally, even under a `ctx.provider` override. --local-only is a hard
 * safety flag: it must never make a network call. Forcing a network provider
 * while offline yields a clean miss (the caller explains the conflict), never a
 * silent network request.
 * Provider override: `ctx.provider` (a full name like "hanzo.image" or a prefix
 * like "catalog") pins resolution to matching providers only — this is how a
 * user "generate this image, do not search" skips the catalog rung.
 */
export async function runProviders(providers, capability, intent, ctx) {
  const want = ctx?.provider;
  for (const p of providers) {
    if (want && p.name !== want && !p.name.startsWith(`${want}.`)) continue;
    if (p.network && ctx?.localOnly) continue; // --local-only wins, even over --provider
    const fn = p[capability];
    if (typeof fn !== "function") continue;
    const res = await fn(intent, ctx);
    if (res) return res;
  }
  return null;
}

/** Run a capability over the providers for a type (deterministic, catalog-first). */
export async function runCapability(type, capability, intent, ctx) {
  return runProviders(getProviders(type), capability, intent, ctx);
}
