/**
 * Which voice / music engine a workflow will actually use, and whether
 * its local dependencies are present. Mirrors the resolution order the
 * media-use skill scripts use, so `auth status` and `doctor`
 * report the same engine the render pipeline would pick:
 *
 *   voice: Hanzo speech (credential) → Kokoro (local)
 *   music: MusicGen (local)
 *
 * The decision is split from the probing: `decide*` is pure (unit-tested
 * without spawning Python); `gather*` collects the live facts.
 */

import { hasPythonModules } from "../tts/python.js";

/** Python import names probed for each local engine. */
export const KOKORO_MODULES = ["kokoro_onnx", "soundfile"];
export const MUSICGEN_MODULES = ["transformers", "torch", "soundfile", "numpy"];

/** pip one-liners shown when a local engine's deps are missing. */
export const KOKORO_PIP = "pip install kokoro-onnx soundfile";
export const MUSICGEN_PIP = "pip install transformers torch soundfile numpy";

export type VoiceEngine = "hanzo" | "kokoro";
export type MusicEngine = "musicgen";

export interface EngineReadiness<E> {
  engine: E;
  /** Human label, e.g. "Kokoro". */
  label: string;
  /** A local engine (no account needed) vs a hosted one keyed by credential. */
  local: boolean;
  /** Usable right now: credential present, or local deps installed. */
  ready: boolean;
  /** Shown when `ready` is false — how to make it ready. */
  setupHint?: string;
}

export interface VoiceFacts {
  /** A Hanzo credential resolved, so `POST /v1/audio/speech` is reachable. */
  hosted: boolean;
  /** Kokoro's local deps importable. */
  kokoro: boolean;
}

export interface MusicFacts {
  /** MusicGen's local deps importable. */
  musicgen: boolean;
}

export function decideVoice(f: VoiceFacts): EngineReadiness<VoiceEngine> {
  if (f.hosted) return { engine: "hanzo", label: "Hanzo speech", local: false, ready: true };
  return {
    engine: "kokoro",
    label: "Kokoro",
    local: true,
    ready: f.kokoro,
    ...(f.kokoro ? {} : { setupHint: KOKORO_PIP }),
  };
}

export function decideMusic(f: MusicFacts): EngineReadiness<MusicEngine> {
  return {
    engine: "musicgen",
    label: "MusicGen",
    local: true,
    ready: f.musicgen,
    ...(f.musicgen ? {} : { setupHint: MUSICGEN_PIP }),
  };
}

/** Collect live voice facts. Skips the Python probe when speech is hosted. */
function gatherVoiceFacts(hosted: boolean): VoiceFacts {
  if (hosted) return { hosted, kokoro: false };
  return { hosted, kokoro: hasPythonModules(KOKORO_MODULES) };
}

export function resolveVoice(hosted: boolean): EngineReadiness<VoiceEngine> {
  return decideVoice(gatherVoiceFacts(hosted));
}

export function resolveMusic(): EngineReadiness<MusicEngine> {
  return decideMusic({ musicgen: hasPythonModules(MUSICGEN_MODULES) });
}
