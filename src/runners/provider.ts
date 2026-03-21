import type {
  AgentProvider,
  AgentResult,
  AgentRunRecord,
  PermissionProfile,
  ProviderConfig,
} from "../core/types.js";
import { log } from "../utils/logger.js";

export interface RunOptions {
  cwd: string;
  timeout: number;
  permissionProfile: PermissionProfile;
}

/**
 * Base provider runner. Each agent provider extends this
 * with its specific argument builder and output parser.
 */
export abstract class ProviderRunner {
  abstract readonly provider: AgentProvider;

  constructor(protected config: ProviderConfig) {}

  abstract buildArgs(
    prompt: string,
    profile: PermissionProfile
  ): string[];

  abstract parseOutput(stdout: string): string;

  async run(prompt: string, opts: RunOptions): Promise<AgentResult> {
    const start = Date.now();
    const startedAt = new Date().toISOString();
    const args = this.buildArgs(prompt, opts.permissionProfile);
    const command = this.config.binary;

    log.info(`Spawning ${command} [${opts.permissionProfile}] in ${opts.cwd}`);

    try {
      const proc = Bun.spawn([command, ...args], {
        cwd: opts.cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env },
      });

      const timeoutId = setTimeout(() => {
        log.warn(`${this.provider} agent timed out after ${opts.timeout}ms`);
        proc.kill();
      }, opts.timeout);

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      clearTimeout(timeoutId);

      const duration = Date.now() - start;
      const finishedAt = new Date().toISOString();

      const record: AgentRunRecord = {
        provider: this.provider,
        permissionProfile: opts.permissionProfile,
        command,
        args,
        stdout,
        stderr,
        exitCode,
        duration,
        startedAt,
        finishedAt,
      };

      if (exitCode !== 0) {
        log.error(
          `${this.provider} agent failed (exit ${exitCode}): ${stderr.slice(0, 500)}`
        );
        return {
          success: false,
          output: stdout,
          exitCode,
          duration,
          error: stderr || `Exit code ${exitCode}`,
          record,
        };
      }

      const output = this.parseOutput(stdout);
      log.success(
        `${this.provider} agent completed in ${(duration / 1000).toFixed(1)}s`
      );
      return { success: true, output, exitCode, duration, record };
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      log.error(`${this.provider} agent spawn failed: ${message}`);

      const record: AgentRunRecord = {
        provider: this.provider,
        permissionProfile: opts.permissionProfile,
        command,
        args,
        stdout: "",
        stderr: message,
        exitCode: 1,
        duration,
        startedAt,
        finishedAt: new Date().toISOString(),
      };

      return {
        success: false,
        output: "",
        exitCode: 1,
        duration,
        error: message,
        record,
      };
    }
  }
}
