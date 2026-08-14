import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePackedTarball, publishedManifest } from "./pack.mjs";

describe("workspace packer", () => {
  it("publishes the built entrypoints a package names under publishConfig", () => {
    const published = publishedManifest({
      name: "@hanzo/frames-core",
      main: "./src/index.ts",
      exports: { ".": { import: "./src/index.ts" } },
      dependencies: { "@hanzo/frames-lint": "workspace:*" },
      publishConfig: {
        access: "public",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: { ".": { import: "./dist/index.js", types: "./dist/index.d.ts" } },
      },
    });

    assert.deepEqual(published.exports, {
      ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
    });
    assert.equal(published.main, "./dist/index.js");
    assert.equal(published.types, "./dist/index.d.ts");
    // Registry settings are npm's, not the manifest's, and the specifiers are bun's.
    assert.equal(published.publishConfig.access, "public");
    assert.deepEqual(published.dependencies, { "@hanzo/frames-lint": "workspace:*" });
  });

  it("leaves a package that names no published entrypoints alone", () => {
    const source = { name: "@hanzo/frames", bin: { frames: "./dist/cli.js" } };

    assert.deepEqual(publishedManifest(source), source);
  });

  it("reads the packed tarball off the last line bun prints", () => {
    assert.equal(
      parsePackedTarball("\n/tmp/pack/hanzo-frames-core-0.7.83.tgz\n", "packages/core"),
      "/tmp/pack/hanzo-frames-core-0.7.83.tgz",
    );
    assert.throws(
      () => parsePackedTarball("error: script not found\n", "packages/core"),
      /bun pm pack did not name a tarball for packages\/core/,
    );
  });
});
