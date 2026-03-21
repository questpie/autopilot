import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getQapRoot } from "../workspace/types.js";
import { loadUpdateMeta, saveUpdateMeta } from "./checker.js";

// ── Lock File ───────────────────────────────────────────────

function getLockPath(): string {
  return `${getQapRoot()}/meta/update.lock`;
}

async function acquireLock(): Promise<boolean> {
  const lockPath = getLockPath();
  const dir = `${getQapRoot()}/meta`;
  await mkdir(dir, { recursive: true });

  if (existsSync(lockPath)) {
    // Check if lock is stale (older than 5 minutes)
    try {
      const raw = await readFile(lockPath, "utf-8");
      const lockData = JSON.parse(raw);
      const elapsed = Date.now() - new Date(lockData.pid_time).getTime();
      if (elapsed < 5 * 60 * 1000) {
        return false; // Lock is fresh, another update is running
      }
    } catch {
      // Malformed lock file, proceed to overwrite
    }
  }

  await writeFile(
    lockPath,
    JSON.stringify({ pid: process.pid, pid_time: new Date().toISOString() })
  );
  return true;
}

async function releaseLock(): Promise<void> {
  try {
    await unlink(getLockPath());
  } catch {
    // Already gone
  }
}

// ── Update Execution ────────────────────────────────────────

export interface UpdateResult {
  success: boolean;
  version?: string;
  error?: string;
}

/**
 * Run the actual update: `bun add -g @questpie/autopilot@latest`
 * Uses a lock file to prevent concurrent updates.
 */
export async function applyUpdate(): Promise<UpdateResult> {
  const locked = await acquireLock();
  if (!locked) {
    return { success: false, error: "Another update is already in progress" };
  }

  try {
    const proc = Bun.spawn(
      ["bun", "add", "-g", "@questpie/autopilot@latest"],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env },
      }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      return {
        success: false,
        error: `bun add failed (exit ${exitCode}): ${stderr.slice(0, 200)}`,
      };
    }

    // Read the newly installed version
    let newVersion: string | undefined;
    try {
      const stdout = await new Response(proc.stdout).text();
      // Try to parse version from bun output
      const match = stdout.match(/@questpie\/autopilot@(\d+\.\d+\.\d+)/);
      if (match) newVersion = match[1];
    } catch {
      // Version detection is best-effort
    }

    // Record the update in metadata
    const meta = await loadUpdateMeta();
    if (meta) {
      meta.updateApplied = newVersion ?? meta.latestVersion ?? "unknown";
      meta.updateAppliedAt = new Date().toISOString();
      await saveUpdateMeta(meta);
    }

    return { success: true, version: newVersion };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await releaseLock();
  }
}

/**
 * Run update in background (fire-and-forget).
 * Does not block the calling process.
 * Writes result to update metadata for next startup to read.
 */
export function applyUpdateInBackground(): void {
  // Fire and forget — errors are written to update.json
  applyUpdate().catch(() => {
    // Silently ignore — metadata will record the error
  });
}
