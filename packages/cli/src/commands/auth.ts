/**
 * `frames auth` — the credential this CLI presents to api.hanzo.ai.
 *
 * Hanzo IAM issues credentials and `hanzo login` performs the sign-in; this
 * CLI only reads what they leave behind, so `status` is the whole surface.
 */

import { defineCommand } from "citty";
import type { Example } from "./_examples.js";
import { c } from "../ui/colors.js";

export const examples: Example[] = [
  ["Check which credential is active", "frames auth status"],
  ["Machine-readable status", "frames auth status --json"],
];

const HELP = `
${c.bold("frames auth")} ${c.dim("<subcommand> [args]")}

Show the credential used for ${c.accent("api.hanzo.ai")}. Sign in with
${c.accent("hanzo login")} — it runs the Hanzo IAM device flow and writes
${c.accent("~/.hanzo/credentials.json")}, which this CLI reads.

${c.bold("SUBCOMMANDS:")}
  ${c.accent("status")}   ${c.dim("Show the active credential's source and whether the gateway accepts it.")}

${c.bold("ENV VARS:")}
  ${c.accent("HANZO_API_KEY")}   Platform key, delivered from Hanzo KMS. Wins over everything.
  ${c.accent("HANZO_TOKEN")}     IAM access token. Wins over the stored credential.
  ${c.accent("HANZO_HOME")}      Override the credential directory (default ~/.hanzo).
  ${c.accent("HANZO_API_URL")}   Override the API base URL (default https://api.hanzo.ai).
`;

export default defineCommand({
  meta: { name: "auth", description: "Show the credential used for api.hanzo.ai" },
  subCommands: {
    status: () => import("./auth/status.js").then((m) => m.default),
  },
  async run({ args }) {
    if (!args._?.[0]) console.log(HELP);
  },
});
