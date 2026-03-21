import type {
  AgentProvider,
  AgentResult,
  PermissionProfile,
  ProviderConfig,
} from "../core/types.js";
import type { ProviderEventSink } from "../events/types.js";
import type { RunOptions } from "./provider.js";

export interface StreamingRunOptions extends RunOptions {
  sink?: ProviderEventSink;
  taskId?: string;
  phase?: string;
}

/**
 * Base class for streaming-capable provider runners.
 * Extends the existing ProviderRunner contract with event sink support.
 *
 * Subclasses implement runStreaming() which emits normalized
 * ProviderEvents to the sink during execution while still
 * returning a final AgentResult for compatibility.
 */
export abstract class StreamingProviderRunner {
  abstract readonly provider: AgentProvider;

  constructor(protected config: ProviderConfig) {}

  /**
   * Run with streaming events.
   * Emits normalized provider events to opts.sink during execution.
   * Returns final AgentResult for backward compatibility.
   */
  abstract runStreaming(
    prompt: string,
    opts: StreamingRunOptions
  ): Promise<AgentResult>;
}
