import type { CheckResult } from "./checker.js";

// ── ANSI Colors ─────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
} as const;

// ── CLI Notifications ───────────────────────────────────────

/**
 * Print a one-line update banner to stderr (non-blocking, doesn't interfere with stdout).
 */
export function printUpdateBanner(result: CheckResult): void {
  if (result.updateApplied) {
    console.error(
      `${C.green}${C.bold}✓ Updated to ${result.updateApplied}${C.reset}${C.dim} — restart qap to use the new version${C.reset}`
    );
    return;
  }

  if (result.updateAvailable && result.latestVersion) {
    console.error(
      `${C.yellow}${C.bold}Update available:${C.reset} ${C.dim}${result.currentVersion}${C.reset} → ${C.green}${result.latestVersion}${C.reset}  ${C.dim}Run:${C.reset} ${C.cyan}bun add -g @questpie/autopilot@latest${C.reset}`
    );
  }
}

// ── TUI Status Line ─────────────────────────────────────────

/**
 * Returns a short status string for TUI display, or null if nothing to show.
 */
export function getUpdateStatusText(result: CheckResult): string | null {
  if (result.updateApplied) {
    return `Updated to ${result.updateApplied} — restart qap`;
  }
  if (result.updateAvailable && result.latestVersion) {
    return `Update: ${result.currentVersion} → ${result.latestVersion}`;
  }
  return null;
}
