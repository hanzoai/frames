import { failCommand } from "../../utils/commandResult.js";
/**
 * `frames auth status` — print which credential this machine presents to
 * api.hanzo.ai and where it came from.
 *
 * Exits non-zero when nothing is configured, so scripts can check "do I have a
 * credential?" with `$?`. Whether the API accepts it is answered by the call
 * that uses it — there is no separate probe to disagree with.
 *
 * When nothing is configured the output is onboarding-first: an interactive
 * session (a TTY, or a coding agent driving the CLI) gets guidance led by
 * `hanzo login`, while CI / non-interactive runs get a terse note and continue
 * on local engines. This is the shared preflight every TTS/BGM workflow
 * relays, so the wording lives in one place instead of each workflow
 * improvising its own.
 */

import { defineCommand } from "citty";
import { credential, describeSource, type Credential } from "../../api.js";
import { getSystemMeta } from "../../telemetry/system.js";
import { c } from "../../ui/colors.js";
import { resolveMusic, resolveVoice } from "../../audio/providers.js";
import {
  buildUnconfiguredJson,
  buildUnconfiguredLines,
  type OfflineEngineLine,
  type UnconfiguredContext,
} from "./status-guidance.js";

export default defineCommand({
  meta: { name: "status", description: "Show the credential used for api.hanzo.ai" },
  args: {
    json: {
      type: "boolean",
      description: "Emit machine-readable JSON",
      default: false,
    },
  },
  async run({ args }) {
    const asJson = Boolean(args.json);
    const cred = await credential();
    if (!cred) {
      handleUnconfigured(asJson);
      return;
    }

    if (asJson) printJsonStatus(cred);
    else printHumanStatus(cred);
  },
});

/**
 * Decide whether to show full onboarding guidance or a terse note.
 * CI is never "interactive" even on a TTY; an agent runtime counts as
 * interactive because a human is watching its relayed output.
 */
function detectUnconfiguredContext(): UnconfiguredContext {
  const sys = getSystemMeta();
  return { interactive: !sys.is_ci && (sys.is_tty || sys.agent_runtime !== null) };
}

/**
 * Probe the local voice/music engines a workflow would fall back to. We only
 * reach this with no credential, so speech is not hosted and this reports the
 * offline engines and whether their Python deps are installed.
 */
function collectOfflineEngines(): OfflineEngineLine[] {
  const voice = resolveVoice(false);
  const music = resolveMusic();
  return [
    { capability: "voice", label: voice.label, ready: voice.ready, ...hint(voice.setupHint) },
    { capability: "music", label: music.label, ready: music.ready, ...hint(music.setupHint) },
  ];
}

function hint(setupHint: string | undefined): { setupHint?: string } {
  return setupHint ? { setupHint } : {};
}

function handleUnconfigured(asJson: boolean): never {
  const ctx = detectUnconfiguredContext();
  // Probe engines for JSON (skills parse it) and interactive guidance; skip
  // the Python probes for terse non-interactive/CI output to stay fast.
  const engines = asJson || ctx.interactive ? collectOfflineEngines() : undefined;
  const output = asJson
    ? JSON.stringify(buildUnconfiguredJson(ctx, engines))
    : buildUnconfiguredLines(ctx, engines).join("\n");
  console.log(output);
  failCommand();
}

function printJsonStatus(cred: Credential): void {
  console.log(
    JSON.stringify(
      {
        configured: true,
        source: cred.source,
        account: cred.subject ?? null,
        owner: cred.owner ?? null,
      },
      null,
      2,
    ),
  );
}

function printHumanStatus(cred: Credential): void {
  const rows: [string, string][] = [["Source:", describeSource(cred.source)]];
  if (cred.subject) rows.push(["Account:", cred.subject]);
  if (cred.owner) rows.push(["Org:    ", cred.owner]);
  for (const [label, value] of rows) console.log(`${c.bold(label)} ${value}`);
}
