import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Version comparison ──────────────────────────────────────

import { isNewer, shouldCheck } from "../src/update/checker.js";

describe("isNewer", () => {
  it("detects newer major version", () => {
    expect(isNewer("2.0.0", "1.0.0")).toBe(true);
  });

  it("detects newer minor version", () => {
    expect(isNewer("1.2.0", "1.1.0")).toBe(true);
  });

  it("detects newer patch version", () => {
    expect(isNewer("1.1.2", "1.1.1")).toBe(true);
  });

  it("returns false for same version", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false for older version", () => {
    expect(isNewer("1.0.0", "1.0.1")).toBe(false);
  });

  it("returns false for older major", () => {
    expect(isNewer("0.9.9", "1.0.0")).toBe(false);
  });

  it("handles missing patch", () => {
    expect(isNewer("1.1", "1.0.0")).toBe(true);
  });
});

// ── Throttle logic ──────────────────────────────────────────

describe("shouldCheck", () => {
  it("returns true when no metadata exists", () => {
    expect(shouldCheck(null, 24)).toBe(true);
  });

  it("returns true when no lastCheck", () => {
    expect(
      shouldCheck(
        { lastCheck: "", latestVersion: null, currentVersion: "0.1.0" },
        24
      )
    ).toBe(true);
  });

  it("returns false within interval", () => {
    const recent = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    expect(
      shouldCheck(
        { lastCheck: recent, latestVersion: null, currentVersion: "0.1.0" },
        24
      )
    ).toBe(false);
  });

  it("returns true after interval elapsed", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
    expect(
      shouldCheck(
        { lastCheck: old, latestVersion: null, currentVersion: "0.1.0" },
        24
      )
    ).toBe(true);
  });

  it("respects custom interval", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(
      shouldCheck(
        { lastCheck: twoHoursAgo, latestVersion: null, currentVersion: "0.1.0" },
        1 // 1 hour interval
      )
    ).toBe(true);

    expect(
      shouldCheck(
        { lastCheck: twoHoursAgo, latestVersion: null, currentVersion: "0.1.0" },
        4 // 4 hour interval
      )
    ).toBe(false);
  });
});

// ── Settings ────────────────────────────────────────────────

import { loadSettings, saveSettings, getDefaultSettings } from "../src/update/settings.js";

describe("settings", () => {
  it("returns defaults for missing file", async () => {
    const settings = await loadSettings();
    expect(settings.update.checkOnStart).toBe(true);
    expect(settings.update.autoUpdate).toBe(false);
    expect(settings.update.checkIntervalHours).toBe(24);
  });

  it("getDefaultSettings returns correct defaults", () => {
    const defaults = getDefaultSettings();
    expect(defaults.update.checkOnStart).toBe(true);
    expect(defaults.update.autoUpdate).toBe(false);
    expect(defaults.update.checkIntervalHours).toBe(24);
  });
});

// ── Notify helpers ──────────────────────────────────────────

import { getUpdateStatusText } from "../src/update/notify.js";

describe("getUpdateStatusText", () => {
  it("returns null when no update", () => {
    expect(
      getUpdateStatusText({
        updateAvailable: false,
        currentVersion: "0.1.0",
        latestVersion: "0.1.0",
        wasThrottled: false,
      })
    ).toBe(null);
  });

  it("returns update text when available", () => {
    const text = getUpdateStatusText({
      updateAvailable: true,
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      wasThrottled: false,
    });
    expect(text).toContain("0.1.0");
    expect(text).toContain("0.2.0");
  });

  it("returns applied text when update was applied", () => {
    const text = getUpdateStatusText({
      updateAvailable: false,
      currentVersion: "0.2.0",
      latestVersion: "0.2.0",
      wasThrottled: false,
      updateApplied: "0.2.0",
    });
    expect(text).toContain("0.2.0");
    expect(text).toContain("restart");
  });
});
