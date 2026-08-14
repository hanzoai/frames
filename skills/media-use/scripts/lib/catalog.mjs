// catalog.mjs — the shared media catalog: files in our own object store
// (hanzoai/s3), browsed through api.hanzo.ai/v1/s3 and matched by name.
//
// A catalog entry is just an object under `media/<type>/`, e.g.
// `media/bgm/calm-cinematic-underscore.mp3`. The key IS the description: words
// in the key are what an intent matches against, so name files in plain words.
// There is no index to keep in step with the bytes and no second service to
// run — the listing is the index.
//
// An empty prefix is a fact, not an error: `find` returns
// `{ empty: true, prefix }` so callers can say "the catalog holds no bgm yet"
// and move on to generation rather than failing the render.

import { PREFIX, foley, link, music, objects, ready, write } from "./api.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STOP = new Set(["a", "an", "the", "and", "of", "for", "with", "some", "sound", "music"]);

const terms = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));

/** How well an object key answers an intent: shared words, longest match first. */
export function score(intent, key) {
  const want = terms(intent);
  if (!want.length) return 0;
  const have = new Set(terms(key));
  const hits = want.filter((t) => have.has(t)).length;
  if (!hits) return 0;
  // Every word matched scores above a partial match of the same size.
  return hits === want.length ? 100 + hits : hits;
}

/** Rank a listing against an intent. Exported so the ranking is testable alone. */
export function rank(intent, entries) {
  return entries
    .map((o) => ({ ...o, score: score(intent, o.key) }))
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/**
 * Best catalog entry for an intent.
 *   { key, url, score, prefix }   a hit
 *   { empty: true, prefix }       the prefix holds nothing yet
 *   null                          the catalog has files, none of them match
 */
export async function find(type, intent) {
  const prefix = PREFIX[type];
  if (!prefix) throw new Error(`no catalog prefix for type: ${type}`);
  if (!ready()) return null;
  const entries = await objects(prefix);
  if (!entries.length) return { empty: true, prefix };
  const best = rank(intent, entries)[0];
  if (!best) return null;
  return { key: best.key, url: await link(prefix + best.key), score: best.score, prefix };
}

/** A catalog hit shaped as a provider result. */
export function asResult(hit, intent, kind) {
  return {
    url: hit.url,
    source: "catalog",
    metadata: {
      description: hit.key.replace(/\.\w+$/, "").replace(/[-_/]+/g, " "),
      provider: `catalog.${kind}`,
      provenance: { key: hit.prefix + hit.key, query: intent, score: hit.score },
    },
  };
}

/**
 * Generate an audio bed when the catalog misses. `kind` picks music or foley.
 * Lands in a temp file and reports its path — the same `{ localPath }` shape
 * every other provider returns, so resolve has one contract to honor.
 */
export async function compose(intent, { kind = "bgm", seconds } = {}) {
  const make = kind === "sfx" ? foley : music;
  const localPath = join(tmpdir(), `media-use-${kind}-${process.pid}-${Date.now()}.wav`);
  write(await make({ prompt: intent, seconds }), localPath);
  return {
    localPath,
    ext: ".wav",
    source: "generated",
    metadata: {
      description: intent,
      provider: kind === "sfx" ? "hanzo.foley" : "hanzo.music",
      provenance: { prompt: intent, ...(Number.isFinite(seconds) ? { seconds } : {}) },
    },
  };
}
