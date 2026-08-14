import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createServer } from "node:http";
import { asResult, find, rank, score } from "./catalog.mjs";

// The catalog is a listing, not an index: an object key IS its description.
// These pin the matching rules and, above all, the empty-shelf answer — an
// empty prefix must read as "nothing has been put here yet", never as a miss
// that looks like a bad query.

test("a key that answers every word of the intent outranks a partial match", () => {
  assert.ok(score("calm cinematic", "calm-cinematic-underscore.mp3") > score("calm cinematic", "calm-piano.mp3"));
  assert.equal(score("calm", "loud-drums.mp3"), 0);
});

test("filler words alone never make a match", () => {
  assert.equal(score("some music for the", "the-music.mp3"), 0);
});

test("rank drops non-matches and breaks ties by key", () => {
  const ranked = rank("whoosh", [
    { key: "impact.mp3" },
    { key: "whoosh-long.mp3" },
    { key: "whoosh-b.mp3" },
    { key: "whoosh-a.mp3" },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.key),
    ["whoosh-a.mp3", "whoosh-b.mp3", "whoosh-long.mp3"],
  );
});

async function serving(handler, fn) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const saved = { ...process.env };
  process.env.HANZO_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.HANZO_API_KEY = "k";
  process.env.HANZO_ORG = "acme";
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    await new Promise((r) => server.close(r));
  }
}

const reply = (res, payload) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};

test("an empty prefix reports itself as empty, not as a miss", async () => {
  await serving(
    (req, res) => reply(res, { objects: [] }),
    async () => {
      const hit = await find("bgm", "anything at all");
      assert.deepEqual(hit, { empty: true, prefix: "bgm/" });
    },
  );
});

test("a stocked prefix with no match is a plain miss", async () => {
  await serving(
    (req, res) => reply(res, { objects: [{ key: "drums.mp3", isDir: false }] }),
    async () => {
      assert.equal(await find("bgm", "harpsichord"), null);
    },
  );
});

test("a hit carries the signed link and the key it came from", async () => {
  await serving(
    (req, res) => {
      if (req.url.startsWith("/v1/s3/buckets/media/objects?")) {
        reply(res, { objects: [{ key: "calm-underscore.mp3", isDir: false }] });
        return;
      }
      reply(res, { url: "https://signed.example/calm", method: "GET" });
    },
    async () => {
      const hit = await find("bgm", "calm underscore");
      assert.equal(hit.key, "calm-underscore.mp3");
      assert.equal(hit.url, "https://signed.example/calm");
      assert.equal(hit.prefix, "bgm/");

      const record = asResult(hit, "calm underscore", "bgm");
      assert.equal(record.source, "catalog");
      assert.equal(record.metadata.provider, "catalog.bgm");
      assert.equal(record.metadata.description, "calm underscore");
      assert.equal(record.metadata.provenance.key, "bgm/calm-underscore.mp3");
    },
  );
});

test("no credential means no catalog call at all", async () => {
  const saved = process.env.HANZO_API_KEY;
  delete process.env.HANZO_API_KEY;
  try {
    assert.equal(await find("bgm", "calm"), null);
  } finally {
    if (saved !== undefined) process.env.HANZO_API_KEY = saved;
  }
});

test("an unknown type is a programming error, not a miss", async () => {
  await assert.rejects(find("nope", "x"), /no catalog prefix for type: nope/);
});
