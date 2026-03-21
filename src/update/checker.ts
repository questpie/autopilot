import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getQapRoot } from "../workspace/types.js";
import { loadSettings } from "./settings.js";

// ── Update Check Types ──────────────────────────────────────

export interface UpdateMeta {
  lastCheck: string; // ISO timestamp
  latestVersion: string | null;
  currentVersion: string;
  updateApplied?: string; // version that was auto-updated to
  updateAppliedAt?: string;
  error?: string;
}

// ── Paths ───────────────────────────────────────────────────

function getMetaDir(): string {
  return `${getQapRoot()}/meta`;
}

function getMetaPath(): string {
  return `${getMetaDir()}/update.json`;
}

// ── Version Helpers ─────────────────────────────────────────

export function getCurrentVersion(): string {
  // Read from package.json at build/runtime
  // Bun resolves this relative to the module
  try {
    const pkg = require("../../package.json");
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

/**
 * Simple semver comparison: returns true if remote > local.
 * Handles x.y.z format only (no pre-release tags).
 */
export function isNewer(remote: string, local: string): boolean {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

// ── Metadata Persistence ────────────────────────────────────

export async function loadUpdateMeta(): Promise<UpdateMeta | null> {
  try {
    const raw = await readFile(getMetaPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveUpdateMeta(meta: UpdateMeta): Promise<void> {
  const dir = getMetaDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getMetaPath(), JSON.stringify(meta, null, 2) + "\n");
}

// ── Throttle Check ──────────────────────────────────────────

export function shouldCheck(
  meta: UpdateMeta | null,
  intervalHours: number
): boolean {
  if (!meta?.lastCheck) return true;
  const elapsed = Date.now() - new Date(meta.lastCheck).getTime();
  return elapsed >= intervalHours * 60 * 60 * 1000;
}

// ── Registry Fetch ──────────────────────────────────────────

export async function fetchLatestVersion(
  packageName: string = "@questpie/autopilot"
): Promise<string | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

// ── Main Check Flow ─────────────────────────────────────────

export interface CheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  wasThrottled: boolean;
  updateApplied?: string; // set if a background update was completed previously
}

/**
 * Check for updates. Respects throttle interval.
 * Returns immediately with cached data if within interval.
 * Network errors are silently swallowed.
 */
export async function checkForUpdate(
  force: boolean = false
): Promise<CheckResult> {
  const settings = await loadSettings();
  const meta = await loadUpdateMeta();
  const currentVersion = getCurrentVersion();

  // Check if a background update was applied
  const updateApplied = meta?.updateApplied;
  if (updateApplied && meta) {
    // Clear the applied flag after reading
    meta.updateApplied = undefined;
    meta.updateAppliedAt = undefined;
    await saveUpdateMeta(meta);
  }

  // Throttle unless forced
  if (!force && !shouldCheck(meta, settings.update.checkIntervalHours)) {
    return {
      updateAvailable: meta?.latestVersion
        ? isNewer(meta.latestVersion, currentVersion)
        : false,
      currentVersion,
      latestVersion: meta?.latestVersion ?? null,
      wasThrottled: true,
      updateApplied,
    };
  }

  // Fetch from registry
  const latestVersion = await fetchLatestVersion();

  const newMeta: UpdateMeta = {
    lastCheck: new Date().toISOString(),
    latestVersion,
    currentVersion,
    ...(meta?.updateApplied && !updateApplied
      ? {
          updateApplied: meta.updateApplied,
          updateAppliedAt: meta.updateAppliedAt,
        }
      : {}),
  };
  await saveUpdateMeta(newMeta);

  return {
    updateAvailable: latestVersion ? isNewer(latestVersion, currentVersion) : false,
    currentVersion,
    latestVersion,
    wasThrottled: false,
    updateApplied,
  };
}
