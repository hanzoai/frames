/**
 * How this CLI reaches `api.hanzo.ai`, and the credential it presents.
 *
 * Hanzo IAM issues credentials; this CLI only reads them. `hanzo login` runs
 * the IAM device flow and writes `~/.hanzo/credentials.json`; CI and services
 * receive a platform key from Hanzo KMS in the environment. Nothing here
 * mints, refreshes, prompts for, or writes a credential — that is IAM's job,
 * and the `hanzo` CLI is the one place a human performs it.
 *
 * Precedence matches the `hanzo` CLI: env before store, platform key before
 * user token.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_BASE_URL = "https://api.hanzo.ai";

/** Base URL for every API call. `HANZO_API_URL` points it at a dev gateway. */
export function apiBaseUrl(): string {
  const override = process.env["HANZO_API_URL"];
  const base = override && override.length > 0 ? override : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

export type CredentialSource = "HANZO_API_KEY" | "HANZO_TOKEN" | "store";

export interface Credential {
  token: string;
  source: CredentialSource;
  /** Who the token belongs to, when the store recorded it. */
  subject?: string;
  /** Org slug the token is scoped to, when the store recorded it. */
  owner?: string;
}

/** `~/.hanzo/credentials.json`, written by `hanzo login`. `HANZO_HOME` moves it. */
export function credentialPath(): string {
  const home = process.env["HANZO_HOME"];
  return join(home && home.length > 0 ? home : join(homedir(), ".hanzo"), "credentials.json");
}

/**
 * The credential to present, or `null` when the machine has none. An expired
 * stored token counts as none: refreshing it is `hanzo login`'s job, so the
 * remedy is the same either way.
 */
export async function credential(): Promise<Credential | null> {
  const key = process.env["HANZO_API_KEY"];
  if (key && key.length > 0) return { token: key, source: "HANZO_API_KEY" };

  const token = process.env["HANZO_TOKEN"];
  if (token && token.length > 0) return { token, source: "HANZO_TOKEN" };

  return await readStoredCredential();
}

async function readStoredCredential(): Promise<Credential | null> {
  let raw: string;
  try {
    raw = await readFile(credentialPath(), "utf8");
  } catch {
    return null;
  }
  let store: unknown;
  try {
    store = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!store || typeof store !== "object") return null;
  const fields = store as Record<string, unknown>;
  const token = fields["access_token"];
  if (typeof token !== "string" || token.length === 0) return null;
  const expiry = fields["expiry"];
  if (typeof expiry === "number" && expiry > 0 && Date.now() / 1000 >= expiry) return null;
  return {
    token,
    source: "store",
    ...pickString(fields, "subject"),
    ...pickString(fields, "owner"),
  };
}

function pickString(fields: Record<string, unknown>, key: string): Record<string, string> {
  const value = fields[key];
  return typeof value === "string" && value.length > 0 ? { [key]: value } : {};
}

export function headers(cred: Credential): Record<string, string> {
  return { authorization: `Bearer ${cred.token}` };
}

/** Where a credential came from, for `auth status`. */
export function describeSource(source: CredentialSource): string {
  return source === "store" ? `file (${credentialPath()})` : `env (${source})`;
}
