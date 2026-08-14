// sfx.mjs — sound effects for the media audio engine. Each cue is resolved in
// the same order, cheapest first:
//
//   library   the 21 files bundled with this skill (assets/sfx/manifest.json).
//             Offline, deterministic, free — and the same bytes every run.
//   catalog   media/sfx/ in our object store, for the long tail the 21 miss.
//   foley     POST /v1/audio/foley when neither has it.
//
// A cue nothing can answer is skipped and recorded as an anomaly; SFX never
// blocks a render. Every cue sits at volume 0.35, under voice and BGM.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { save } from "../../../scripts/lib/api.mjs";
import { compose, find } from "../../../scripts/lib/catalog.mjs";

const SFX_VOLUME = 0.35;
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";
const r3 = (x) => Number(x.toFixed(3));

/**
 * Build the lookup for the bundled library: by manifest key, by file basename,
 * and by slug of either, so a cue can name "whoosh", "whoosh.mp3", or
 * "ui click" and all three land.
 */
export function indexLibrary(manifest) {
  const byName = new Map();
  for (const [key, entry] of Object.entries(manifest)) {
    if (!entry?.file || !isFinite(entry.duration)) continue;
    const rec = { key, file: entry.file, duration: entry.duration };
    byName.set(key, rec);
    byName.set(entry.file, rec);
    byName.set(slug(key), rec);
    byName.set(slug(entry.file.replace(/\.\w+$/, "")), rec);
  }
  return byName;
}

function readLibrary(sfxLibDir, anomalies) {
  const manifestPath = join(sfxLibDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    anomalies.push(`no SFX library at ${sfxLibDir} — the bundled rung is unavailable`);
    return new Map();
  }
  try {
    return indexLibrary(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (e) {
    anomalies.push(`SFX manifest parse failed (${e.message}) — the bundled rung is unavailable`);
    return new Map();
  }
}

// cues: [{ id, name }] (id = the line/frame/scene the cue fires in). Returns
// { sfx: [{ id, name, file, source, offset_s, duration_s, volume }], anomalies }.
export async function resolveSfx({ cues, framesDir, sfxLibDir }) {
  const sfx = [];
  const anomalies = [];
  const destDir = join(framesDir, "assets", "sfx");

  // Dedupe identical (id,name) cues — the same effect named twice in one line
  // resolves once.
  const seen = new Set();
  const uniq = cues.filter((c) => {
    const k = `${c.id}:${c.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!uniq.length) return { sfx, anomalies };

  const library = readLibrary(sfxLibDir, anomalies);
  mkdirSync(destDir, { recursive: true });

  for (const { id, name } of uniq) {
    const hit = library.get(name) ?? library.get(slug(name));
    if (hit) {
      const src = join(sfxLibDir, hit.file);
      const rel = `assets/sfx/${hit.file}`;
      const dest = join(framesDir, rel);
      // The bundled library may be incomplete: some installs ship manifest.json
      // without the mp3s. An entry pointing at a file we never copied is a
      // dangling reference that drops silently downstream, so say so and try
      // the next rung instead.
      if (existsSync(dest) || existsSync(src)) {
        if (!existsSync(dest)) copyFileSync(src, dest);
        sfx.push({
          id,
          name,
          file: rel,
          source: "library",
          offset_s: 0,
          duration_s: r3(hit.duration),
          volume: SFX_VOLUME,
        });
        continue;
      }
      anomalies.push(
        `sfx "${name}" (id ${id}): bundled file ${hit.file} is missing from ${sfxLibDir}`,
      );
    }

    const rel = `assets/sfx/${slug(name)}`;
    try {
      const found = await find("sfx", name);
      if (found && !found.empty) {
        const file = `${rel}${(/\.\w+$/.exec(found.key) ?? [".mp3"])[0]}`;
        await save(found.url, join(framesDir, file));
        sfx.push({
          id,
          name,
          file,
          source: "catalog",
          offset_s: 0,
          duration_s: null,
          volume: SFX_VOLUME,
        });
        continue;
      }
      const made = await compose(name, { kind: "sfx" });
      const file = `${rel}.wav`;
      copyFileSync(made.localPath, join(framesDir, file));
      rmSync(made.localPath, { force: true });
      sfx.push({
        id,
        name,
        file,
        source: "foley",
        offset_s: 0,
        duration_s: null,
        volume: SFX_VOLUME,
      });
    } catch (e) {
      anomalies.push(`sfx "${name}" (id ${id}): not in the library and none could be made — ${e.message}`);
    }
  }
  return { sfx, anomalies };
}
