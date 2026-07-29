#!/usr/bin/env node

// Thin wrapper over the shared packet builder in frames-core — this file only
// pins the paths that are specific to this workflow skill. The logic (frame
// splitting, rule citation, packet bounds, `_role.md` assembly) has one owner:
// ../../frames-core/scripts/lib/frame-packets-core.mjs

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "../../frames-core/scripts/lib/frame-packets-core.mjs";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = {
  animationDir: resolve(SKILL_DIR, "../frames-animation"),
  corePath: resolve(SKILL_DIR, "../frames-core/references/frame-worker-core.md"),
  deltaPath: resolve(SKILL_DIR, "sub-agents/frame-worker.md"),
};

export function buildRolePayload({ outDir }) {
  return core.buildRolePayload({ ...CONFIG, outDir });
}

export function buildFramePackets(options) {
  return core.buildFramePackets({ ...CONFIG, ...options });
}

if (core.isMainModule(import.meta.url)) core.runCli({ buildFramePackets, buildRolePayload });
