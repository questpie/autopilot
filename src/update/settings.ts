import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getQapRoot } from "../workspace/types.js";

// ── QAP Settings Model ──────────────────────────────────────

export interface UpdateSettings {
  checkOnStart: boolean;
  autoUpdate: boolean;
  checkIntervalHours: number;
}

export interface QapSettings {
  update: UpdateSettings;
}

const DEFAULTS: QapSettings = {
  update: {
    checkOnStart: true,
    autoUpdate: false,
    checkIntervalHours: 24,
  },
};

function getSettingsPath(): string {
  return `${getQapRoot()}/settings.json`;
}

export async function loadSettings(): Promise<QapSettings> {
  const path = getSettingsPath();
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      update: {
        ...DEFAULTS.update,
        ...parsed?.update,
      },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings: QapSettings): Promise<void> {
  const path = getSettingsPath();
  await mkdir(getQapRoot(), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n");
}

export function getDefaultSettings(): QapSettings {
  return { ...DEFAULTS, update: { ...DEFAULTS.update } };
}
