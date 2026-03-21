import type {
  AgentResult,
  AgentRunRecord,
  PermissionProfile,
  ProviderConfig,
} from "../core/types.js";
import type { ProviderEvent, ProviderEventSink } from "../events/types.js";
import { StreamingProviderRunner, type StreamingRunOptions } from "./streaming.js";
import { log } from "../utils/logger.js";

// ── Permission mapping ─────────────────────────────────────

function mapPermissionMode(profile: PermissionProfile): string {
  switch (profile) {
    case "safe":
      return "default";
    case "elevated":
      return "acceptEdits";
    case "max":
      return "bypassPermissions";
  }
}

function mapAllowedTools(profile: PermissionProfile): string[] {
  switch (profile) {
    case "safe":
      return ["Read", "Glob", "Grep", "Bash"];
    case "elevated":
      return ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
    case "max":
      return ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "WebSearch", "WebFetch"];
  }
}

// ── Event helpers ───────────────────────────────────────────

function emit(
  sink: ProviderEventSink | undefined,
  event: ProviderEvent
): void {
  if (sink) {
    try {
      sink(event);
    } catch {
      // Never let sink errors crash the runner
    }
  }
}

function ts(): string {
  return new Date().toISOString();
}

// ── Claude SDK Runner ───────────────────────────────────────

export class ClaudeSdkRunner extends StreamingProviderRunner {
  readonly provider = "claude" as const;

  async runStreaming(
    prompt: string,
    opts: StreamingRunOptions
  ): Promise<AgentResult> {
    const start = Date.now();
    const startedAt = ts();
    const sessionId = opts.taskId ?? crypto.randomUUID().slice(0, 8);

    emit(opts.sink, {
      type: "session-start",
      ts: startedAt,
      provider: "claude-sdk",
      sessionId,
      taskId: opts.taskId,
      phase: opts.phase,
      payload: {},
    });

    log.info(`Claude SDK runner [${opts.permissionProfile}] in ${opts.cwd}`);

    let resultText = "";
    let sdkSessionId: string | undefined;
    let stopReason: string | undefined;

    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      const permissionMode = mapPermissionMode(opts.permissionProfile);
      const allowedTools = mapAllowedTools(opts.permissionProfile);

      const queryOpts: Record<string, unknown> = {
        cwd: opts.cwd,
        allowedTools,
        permissionMode,
        maxTurns: 200,
      };

      if (opts.permissionProfile === "max") {
        queryOpts.allowDangerouslySkipPermissions = true;
      }

      for await (const message of query({
        prompt,
        options: queryOpts as any,
      })) {
        const msg = message as any;

        // ── System init ──
        if (msg.type === "system" && msg.subtype === "init") {
          sdkSessionId = msg.session_id;
          emit(opts.sink, {
            type: "session-start",
            ts: ts(),
            provider: "claude-sdk",
            sessionId,
            taskId: opts.taskId,
            phase: opts.phase,
            payload: { sdkSessionId },
          });
          continue;
        }

        // ── Subagent start ──
        if (msg.type === "system" && msg.subtype === "task_started") {
          emit(opts.sink, {
            type: "subagent-start",
            ts: ts(),
            provider: "claude-sdk",
            sessionId,
            taskId: opts.taskId,
            phase: opts.phase,
            payload: { agentId: msg.task_id ?? "unknown" },
          });
          continue;
        }

        // ── Subagent notification ──
        if (msg.type === "system" && msg.subtype === "task_notification") {
          emit(opts.sink, {
            type: "subagent-stop",
            ts: ts(),
            provider: "claude-sdk",
            sessionId,
            taskId: opts.taskId,
            phase: opts.phase,
            payload: { agentId: msg.task_id ?? "unknown" },
          });
          continue;
        }

        // ── Result (success or error) ──
        if (msg.type === "result") {
          stopReason = msg.stop_reason ?? undefined;
          if (msg.subtype === "success") {
            resultText = msg.result ?? "";
          }
          emit(opts.sink, {
            type: "result",
            ts: ts(),
            provider: "claude-sdk",
            sessionId,
            taskId: opts.taskId,
            phase: opts.phase,
            payload: {
              text: (resultText || "").slice(0, 2000),
              stopReason,
            },
          });
          continue;
        }

        // ── Assistant message (full turn) ──
        if (msg.type === "assistant" && msg.message) {
          const content = msg.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text") {
                emit(opts.sink, {
                  type: "assistant-message",
                  ts: ts(),
                  provider: "claude-sdk",
                  sessionId,
                  taskId: opts.taskId,
                  phase: opts.phase,
                  payload: { text: (block.text ?? "").slice(0, 1000) },
                });
              } else if (block.type === "tool_use") {
                emit(opts.sink, {
                  type: "tool-call-start",
                  ts: ts(),
                  provider: "claude-sdk",
                  sessionId,
                  taskId: opts.taskId,
                  phase: opts.phase,
                  payload: {
                    toolName: block.name ?? "unknown",
                    toolId: block.id,
                    input: block.input,
                  },
                });
              }
            }
          }
          continue;
        }

        // ── Stream event (deltas) ──
        if (msg.type === "stream_event" && msg.event) {
          const ev = msg.event;
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            emit(opts.sink, {
              type: "assistant-text-delta",
              ts: ts(),
              provider: "claude-sdk",
              sessionId,
              taskId: opts.taskId,
              phase: opts.phase,
              payload: { text: ev.delta.text ?? "" },
            });
          }
          continue;
        }

        // ── Tool progress ──
        if (msg.type === "tool_progress") {
          emit(opts.sink, {
            type: "tool-call-update",
            ts: ts(),
            provider: "claude-sdk",
            sessionId,
            taskId: opts.taskId,
            phase: opts.phase,
            payload: {
              toolName: msg.tool_name ?? "unknown",
              toolId: msg.tool_use_id,
              progress: `${msg.elapsed_time_seconds ?? 0}s`,
            },
          });
          continue;
        }

        // ── Tool use summary (tool completed) ──
        if (msg.type === "tool_use_summary") {
          const isError = msg.is_error ?? false;
          if (isError) {
            emit(opts.sink, {
              type: "tool-call-fail",
              ts: ts(),
              provider: "claude-sdk",
              sessionId,
              taskId: opts.taskId,
              phase: opts.phase,
              payload: {
                toolName: msg.tool_name ?? "unknown",
                toolId: msg.tool_use_id,
                error: (msg.error ?? "tool failed").slice(0, 200),
              },
            });
          } else {
            emit(opts.sink, {
              type: "tool-call-end",
              ts: ts(),
              provider: "claude-sdk",
              sessionId,
              taskId: opts.taskId,
              phase: opts.phase,
              payload: {
                toolName: msg.tool_name ?? "unknown",
                toolId: msg.tool_use_id,
              },
            });
          }
          continue;
        }
      }

      const duration = Date.now() - start;
      const finishedAt = ts();

      emit(opts.sink, {
        type: "session-end",
        ts: finishedAt,
        provider: "claude-sdk",
        sessionId,
        taskId: opts.taskId,
        phase: opts.phase,
        payload: { reason: stopReason, duration },
      });

      log.success(
        `Claude SDK completed in ${(duration / 1000).toFixed(1)}s`
      );

      const record: AgentRunRecord = {
        provider: "claude",
        permissionProfile: opts.permissionProfile,
        command: "claude-sdk",
        args: [opts.permissionProfile],
        stdout: resultText,
        stderr: "",
        exitCode: 0,
        duration,
        startedAt,
        finishedAt,
      };

      return {
        success: true,
        output: resultText,
        exitCode: 0,
        duration,
        record,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const finishedAt = ts();
      const errMessage = err instanceof Error ? err.message : String(err);

      log.error(`Claude SDK failed: ${errMessage}`);

      emit(opts.sink, {
        type: "error",
        ts: finishedAt,
        provider: "claude-sdk",
        sessionId,
        taskId: opts.taskId,
        phase: opts.phase,
        payload: { message: errMessage },
      });

      emit(opts.sink, {
        type: "session-end",
        ts: finishedAt,
        provider: "claude-sdk",
        sessionId,
        taskId: opts.taskId,
        phase: opts.phase,
        payload: { reason: "error", duration },
      });

      const record: AgentRunRecord = {
        provider: "claude",
        permissionProfile: opts.permissionProfile,
        command: "claude-sdk",
        args: [opts.permissionProfile],
        stdout: resultText,
        stderr: errMessage,
        exitCode: 1,
        duration,
        startedAt,
        finishedAt,
      };

      return {
        success: false,
        output: resultText,
        exitCode: 1,
        duration,
        error: errMessage,
        record,
      };
    }
  }
}
