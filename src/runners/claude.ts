import type { PermissionProfile, ProviderConfig } from "../core/types.js";
import { ProviderRunner } from "./provider.js";

const DEFAULT_PROFILES: Record<PermissionProfile, string[]> = {
  safe: ["--output-format", "json"],
  elevated: ["--output-format", "json", "--verbose"],
  max: [
    "--dangerously-skip-permissions",
    "--output-format",
    "json",
    "--verbose",
  ],
};

export const DEFAULT_CLAUDE_CONFIG: ProviderConfig = {
  binary: "claude",
  enabled: true,
  defaultArgs: [],
  timeoutMs: 600_000, // 10 min
  permissionProfiles: DEFAULT_PROFILES,
};

export class ClaudeRunner extends ProviderRunner {
  readonly provider = "claude" as const;

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
    try {
      const parsed = JSON.parse(stdout);
      return parsed.result ?? parsed.content ?? stdout;
    } catch {
      return stdout;
    }
  }
}
