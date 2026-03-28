export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string // ISO 8601
  level: LogLevel
  module: string // [orchestrator], [git], [auth], [webhook], etc.
  message: string
  data?: Record<string, unknown>
  requestId?: string
  agentId?: string
  sessionId?: string
}
