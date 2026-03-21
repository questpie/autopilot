import type { PermissionProfile, ProviderConfig } from "../core/types.js";
import { ProviderRunner } from "./provider.js";

const DEFAULT_PROFILES: Record<PermissionProfile, string[]> = {
  safe: ["--approval-mode", "suggest"],
  elevated: ["--approval-mode", "auto-edit"],
  max: ["--full-auto"],
};

export const DEFAULT_CODEX_CONFIG: ProviderConfig = {
  binary: "codex",
  enabled: true,
  defaultArgs: [],
  timeoutMs: 600_000,
  permissionProfiles: DEFAULT_PROFILES,
};

export class CodexRunner extends ProviderRunner {
  readonly provider = "codex" as const;

  buildArgs(prompt: string, profile: PermissionProfile): string[] {
    const profileArgs =
      this.config.permissionProfiles?.[profile] ??
      DEFAULT_PROFILES[profile];

    return [
      "-p",
      prompt,
      ...(this.config.defaultArgs ?? []),
      ...profileArgs,
    ];
  }

  parseOutput(stdout: string): string {
    return stdout;
  }
}
