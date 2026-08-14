#!/usr/bin/env node
// One packer for the workspace, so the tarball the publish job uploads is the
// tarball the verifier inspected.
//
// bun does two thirds of the job: it packs, and it rewrites the `workspace:`
// specifiers to the concrete version. The last third is publishConfig. A
// package points its `exports` at TypeScript sources so the workspace runs from
// source, and names the built files a consumer loads under publishConfig; `bun
// pm pack` copies that manifest through untouched. So the entrypoint fields are
// swapped for their published spelling, bun packs, and the manifest on disk is
// put back byte for byte.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");

/** The manifest fields that name a file the consumer loads. */
const ENTRYPOINT_FIELDS = ["exports", "main", "module", "types", "typings"];

export function publishedManifest(pkg) {
  const published = { ...pkg };

  for (const field of ENTRYPOINT_FIELDS) {
    if (pkg.publishConfig?.[field] !== undefined) {
      published[field] = pkg.publishConfig[field];
    }
  }

  return published;
}

export function parsePackedTarball(output, workspace) {
  const filename = output.trim().split("\n").at(-1)?.trim() ?? "";

  if (!filename.endsWith(".tgz")) {
    throw new Error(`bun pm pack did not name a tarball for ${workspace}: ${output.trim()}`);
  }

  return filename;
}

export function packWorkspace(workspace, destination) {
  const workspaceDir = join(ROOT, workspace);
  const manifestPath = join(workspaceDir, "package.json");
  const manifest = readFileSync(manifestPath, "utf8");

  writeFileSync(
    manifestPath,
    `${JSON.stringify(publishedManifest(JSON.parse(manifest)), null, 2)}\n`,
  );

  try {
    const packOutput = execFileSync(
      "bun",
      ["pm", "pack", "--quiet", "--destination", destination],
      { cwd: workspaceDir, encoding: "utf8" },
    );
    return parsePackedTarball(packOutput, workspace);
  } finally {
    writeFileSync(manifestPath, manifest);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [workspace, destination] = process.argv.slice(2);
  console.log(packWorkspace(workspace, destination));
}
