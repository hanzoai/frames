import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as api from "./api.mjs";

// The one client. These exercise the wire shape against a local stand-in for
// api.hanzo.ai — request path, method, headers, and how each reply is read —
// so a change to a route or an envelope fails here rather than in a render.

// `await` is load-bearing: without it the restore runs before an async body
// finishes and the next test inherits this one's environment.
async function withEnv(env, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

/** Serve `routes` (path prefix -> handler) and hand the base URL to `fn`. */
async function serving(routes, fn) {
  const seen = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const path = req.url.split("?")[0];
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      const route = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
      if (!route) {
        res.writeHead(404);
        res.end("no route");
        return;
      }
      route[1](res, seen.at(-1));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base, seen);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const jsonRoute = (payload) => (res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};

test("the base URL defaults to api.hanzo.ai and $HANZO_BASE_URL overrides it", async () => {
  await withEnv({ HANZO_BASE_URL: "" }, () => {
    delete process.env.HANZO_BASE_URL;
    assert.equal(api.base(), "https://api.hanzo.ai");
  });
  await withEnv({ HANZO_BASE_URL: "http://localhost:9000/" }, () => {
    assert.equal(api.base(), "http://localhost:9000");
  });
});

test("no credential is a named failure, never a silent one", async () => {
  await withEnv({ HANZO_API_KEY: "" }, () => {
    delete process.env.HANZO_API_KEY;
    assert.equal(api.ready(), false);
    assert.throws(() => api.auth(), /HANZO_API_KEY/);
    assert.throws(() => api.auth(), /kms\.hanzo\.ai/);
  });
});

test("a storage call without an org says so rather than reading another tenant", async () => {
  await withEnv({ HANZO_API_KEY: "k", HANZO_ORG: "" }, () => {
    delete process.env.HANZO_ORG;
    assert.deepEqual(api.auth(), { Authorization: "Bearer k" });
    assert.throws(() => api.auth({ tenant: true }), /HANZO_ORG/);
  });
  await withEnv({ HANZO_API_KEY: "k", HANZO_ORG: "acme" }, () => {
    assert.deepEqual(api.auth({ tenant: true }), {
      Authorization: "Bearer k",
      "X-Org-Id": "acme",
    });
  });
});

test("speech posts to /v1/audio/speech and returns the bytes", async () => {
  await serving(
    {
      "/v1/audio/speech": (res) => {
        res.writeHead(200, { "content-type": "audio/mpeg" });
        res.end(Buffer.from("ID3fake"));
      },
    },
    async (base, seen) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        const bytes = await api.speech({ text: "hello", voice: "v1", speed: 1.1 });
        assert.equal(bytes.toString(), "ID3fake");
        const [call] = seen;
        assert.equal(call.method, "POST");
        assert.equal(call.url, "/v1/audio/speech");
        assert.equal(call.headers.authorization, "Bearer k");
        assert.deepEqual(JSON.parse(call.body.toString()), {
          model: "zen-voice",
          input: "hello",
          response_format: "mp3",
          speed: 1.1,
          voice: "v1",
        });
      });
    },
  );
});

test("transcript asks for word timings and passes through the ones it gets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mu-api-"));
  const file = join(dir, "a.wav");
  writeFileSync(file, "RIFFfake");
  try {
    await serving(
      {
        "/v1/audio/transcriptions": jsonRoute({
          text: "hi there",
          words: [
            { word: "hi", start: 0, end: 0.2 },
            { word: "there", start: 0.2, end: 0.5 },
            { word: "dropped", start: null, end: 1 },
          ],
        }),
      },
      async (base, seen) => {
        await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
          const out = await api.transcript({ file });
          assert.equal(out.text, "hi there");
          assert.deepEqual(out.words, [
            { text: "hi", start: 0, end: 0.2 },
            { text: "there", start: 0.2, end: 0.5 },
          ]);
          const body = seen[0].body.toString();
          assert.match(body, /name="model"/);
          assert.match(body, /timestamp_granularities\[\]/);
          assert.match(body, /verbose_json/);
        });
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a transcript with no timings yields no words, never invented ones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mu-api-"));
  const file = join(dir, "a.wav");
  writeFileSync(file, "RIFFfake");
  try {
    await serving({ "/v1/audio/transcriptions": jsonRoute({ text: "hi there" }) }, async (base) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        const out = await api.transcript({ file });
        assert.equal(out.text, "hi there");
        assert.deepEqual(out.words, []);
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("music and foley are separate routes", async () => {
  await serving(
    {
      "/v1/audio/music": (res) => res.end("music-bytes"),
      "/v1/audio/foley": (res) => res.end("foley-bytes"),
    },
    async (base, seen) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        assert.equal((await api.music({ prompt: "calm", seconds: 12 })).toString(), "music-bytes");
        assert.equal((await api.foley({ prompt: "whoosh" })).toString(), "foley-bytes");
        assert.deepEqual(JSON.parse(seen[0].body.toString()), {
          model: "zen-music",
          prompt: "calm",
          response_format: "wav",
          duration: 12,
        });
        assert.equal(JSON.parse(seen[1].body.toString()).model, "zen-foley");
        assert.equal("duration" in JSON.parse(seen[1].body.toString()), false);
      });
    },
  );
});

test("image reads b64 when offered and downloads a url otherwise", async () => {
  const png = Buffer.from("PNGfake");
  await serving(
    {
      "/v1/images/generations": jsonRoute({ data: [{ b64_json: png.toString("base64") }] }),
    },
    async (base) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        assert.equal((await api.image({ prompt: "a cat" })).toString(), "PNGfake");
      });
    },
  );
  await serving(
    {
      "/v1/images/generations": (res, call) => {
        const here = `http://127.0.0.1:${call.headers.host.split(":")[1]}`;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ url: `${here}/blob.png` }] }));
      },
      "/blob.png": (res) => res.end("PNGfromurl"),
    },
    async (base) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        assert.equal((await api.image({ prompt: "a cat" })).toString(), "PNGfromurl");
      });
    },
  );
});

test("an empty data array is an error naming the route", async () => {
  await serving({ "/v1/videos/generations": jsonRoute({ data: [] }) }, async (base) => {
    await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
      await assert.rejects(api.video({ prompt: "x" }), /\/v1\/videos\/generations returned no result/);
    });
  });
});

test("a non-OK reply carries the status and the body into the error", async () => {
  await serving(
    {
      "/v1/audio/speech": (res) => {
        res.writeHead(402);
        res.end("insufficient balance");
      },
    },
    async (base) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k" }, async () => {
        await assert.rejects(api.speech({ text: "x" }), /HTTP 402/);
        await assert.rejects(api.speech({ text: "x" }), /insufficient balance/);
      });
    },
  );
});

test("objects lists one prefix flat and drops folder entries", async () => {
  await serving(
    {
      "/v1/s3/buckets/media/objects": jsonRoute({
        objects: [
          { key: "calm.mp3", isDir: false, size: 10 },
          { key: "old/", isDir: true, size: 0 },
        ],
      }),
    },
    async (base, seen) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k", HANZO_ORG: "acme" }, async () => {
        const out = await api.objects("bgm/");
        assert.deepEqual(
          out.map((o) => o.key),
          ["calm.mp3"],
        );
        assert.match(seen[0].url, /prefix=bgm%2F/);
        assert.match(seen[0].url, /recursive=true/);
        assert.equal(seen[0].headers["x-org-id"], "acme");
      });
    },
  );
});

test("link returns the signed URL for one key", async () => {
  await serving(
    {
      "/v1/s3/buckets/media/objects/": jsonRoute({ url: "https://signed.example/x", method: "GET" }),
    },
    async (base, seen) => {
      await withEnv({ HANZO_BASE_URL: base, HANZO_API_KEY: "k", HANZO_ORG: "acme" }, async () => {
        assert.equal(await api.link("bgm/calm track.mp3"), "https://signed.example/x");
        assert.equal(seen[0].url, "/v1/s3/buckets/media/objects/bgm/calm%20track.mp3");
      });
    },
  );
});

test("save writes a URL to disk and reports the byte count", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mu-api-"));
  try {
    await serving({ "/blob": (res) => res.end("twelve bytes") }, async (base) => {
      const dest = join(dir, "nested", "out.bin");
      assert.equal(await api.save(`${base}/blob`, dest), 12);
      assert.equal(readFileSync(dest, "utf8"), "twelve bytes");
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
