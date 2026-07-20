import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, "../..");
const python = path.join(repoRoot, "backend/.venv/bin/python");
const script = path.join(repoRoot, "scripts/pos_staging_e2e.py");

export const STAGING_WRITE_CONSENT = "YES_I_ACKNOWLEDGE_STAGING_ONLY";
export const BACKEND_URL = "http://127.0.0.1:18080";
export const FRONTEND_URL = "http://127.0.0.1:15173";
const STAGING_DATABASE = "jayng-autobrand-anglochinese-sales-reimport-sandbox-34676428";
const STAGING_HOST = `${STAGING_DATABASE}.dev.odoo.com`;

export type JsonObject = Record<string, unknown>;

function parsePayload(output: string): JsonObject | null {
  const line = output.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) return null;
  try {
    return JSON.parse(line) as JsonObject;
  } catch {
    return null;
  }
}

export function runStagingCli(args: string[]): JsonObject {
  try {
    const output = execFileSync(python, [script, ...args], {
      cwd: repoRoot,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const payload = parsePayload(output);
    if (!payload?.ok) throw new Error(String(payload?.error || "Staging helper returned invalid JSON."));
    return payload;
  } catch (error) {
    const failure = error as Error & { stdout?: Buffer | string; stderr?: Buffer | string };
    const payload = parsePayload(String(failure.stdout || ""));
    const detail = payload?.error || failure.message || String(failure.stderr || "");
    throw new Error(`Staging helper failed: ${String(detail)}`);
  }
}

export function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function assertApprovedBackendTarget(request: APIRequestContext) {
  const response = await request.get(`${BACKEND_URL}/e2e/staging-target`);
  if (!response.ok()) {
    throw new Error(`Dedicated staging backend fingerprint failed with HTTP ${response.status()}.`);
  }
  const payload = await response.json() as Record<string, unknown>;
  if (
    payload.approvedStaging !== true
    || payload.host !== STAGING_HOST
    || payload.database !== STAGING_DATABASE
  ) {
    throw new Error("Dedicated backend target fingerprint does not match the approved staging sandbox.");
  }
}
