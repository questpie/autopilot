// ── Normalized Provider Event Model ─────────────────────────
//
// Streaming-capable event primitives for all provider runners.
// These events are the primary source for live monitoring,
// TUI logs, validation findings surfacing, and session replay.

export type ProviderEventType =
  | "session-start"
  | "session-end"
  | "assistant-text-delta"
  | "assistant-message"
  | "tool-call-start"
  | "tool-call-update"
  | "tool-call-end"
  | "tool-call-fail"
  | "notification"
  | "subagent-start"
  | "subagent-stop"
  | "result"
  | "error";

export interface ProviderEventBase {
  type: ProviderEventType;
  ts: string;
  provider: string;
  sessionId?: string;
  taskId?: string;
  phase?: string;
}

export interface SessionStartEvent extends ProviderEventBase {
  type: "session-start";
  payload: { sdkSessionId?: string };
}

export interface SessionEndEvent extends ProviderEventBase {
  type: "session-end";
  payload: { reason?: string; duration?: number };
}

export interface AssistantTextDeltaEvent extends ProviderEventBase {
  type: "assistant-text-delta";
  payload: { text: string };
}

export interface AssistantMessageEvent extends ProviderEventBase {
  type: "assistant-message";
  payload: { text: string };
}

export interface ToolCallStartEvent extends ProviderEventBase {
  type: "tool-call-start";
  payload: { toolName: string; toolId?: string; input?: unknown };
}

export interface ToolCallUpdateEvent extends ProviderEventBase {
  type: "tool-call-update";
  payload: { toolName: string; toolId?: string; progress?: string };
}

export interface ToolCallEndEvent extends ProviderEventBase {
  type: "tool-call-end";
  payload: { toolName: string; toolId?: string; output?: string };
}

export interface ToolCallFailEvent extends ProviderEventBase {
  type: "tool-call-fail";
  payload: { toolName: string; toolId?: string; error: string };
}

export interface NotificationEvent extends ProviderEventBase {
  type: "notification";
  payload: { message: string; level?: "info" | "warn" | "error" };
}

export interface SubagentStartEvent extends ProviderEventBase {
  type: "subagent-start";
  payload: { agentId: string; agentType?: string; description?: string };
}

export interface SubagentStopEvent extends ProviderEventBase {
  type: "subagent-stop";
  payload: { agentId: string; result?: string };
}

export interface ResultEvent extends ProviderEventBase {
  type: "result";
  payload: { text: string; stopReason?: string };
}

export interface ErrorEvent extends ProviderEventBase {
  type: "error";
  payload: { message: string; code?: string };
}

export type ProviderEvent =
  | SessionStartEvent
  | SessionEndEvent
  | AssistantTextDeltaEvent
  | AssistantMessageEvent
  | ToolCallStartEvent
  | ToolCallUpdateEvent
  | ToolCallEndEvent
  | ToolCallFailEvent
  | NotificationEvent
  | SubagentStartEvent
  | SubagentStopEvent
  | ResultEvent
  | ErrorEvent;

// ── Event Sink ──────────────────────────────────────────────

export type ProviderEventSink = (event: ProviderEvent) => void;
