import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { API_BASE } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

/** A single chunk from the SSE stream. */
export interface StreamChunk {
  at: number
  type: "text" | "text_delta" | "tool_call" | "tool_result" | "error" | "status"
  content?: string
  tool?: string
  params?: Record<string, unknown>
}

export interface StreamingState {
  /** Whether a streaming session is currently active. */
  isStreaming: boolean
  /** The session ID from the backend (set once the session starts). */
  sessionId: string | null
  /** Accumulated text from text_delta chunks. */
  streamedText: string
  /** Currently active tool calls (pending result). */
  activeToolCalls: Array<{ tool: string; toolCallId?: string; params?: Record<string, unknown> }>
  /** Completed tool results for display. */
  toolResults: Array<{ tool: string; content: string }>
  /** Error message if the stream failed. */
  error: string | null
}

const INITIAL_STATE: StreamingState = {
  isStreaming: false,
  sessionId: null,
  streamedText: "",
  activeToolCalls: [],
  toolResults: [],
  error: null,
}

/**
 * Hook for streaming chat with an agent via POST /api/chat/:agentId SSE endpoint.
 *
 * Returns the current streaming state and a `send` function to initiate a chat.
 */
export function useStreamingChat(agentId: string | null) {
  const [state, setState] = useState<StreamingState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  const send = useCallback(
    async (message: string) => {
      if (!agentId || state.isStreaming) return

      // Cancel any previous stream
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({
        ...INITIAL_STATE,
        isStreaming: true,
      })

      try {
        const res = await fetch(`${API_BASE}/api/chat/${encodeURIComponent(agentId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const body = await res.text()
          setState((s) => ({ ...s, isStreaming: false, error: body || `HTTP ${res.status}` }))
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setState((s) => ({ ...s, isStreaming: false, error: "No response body" }))
          return
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE lines
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? "" // Keep incomplete line in buffer

          let currentEvent = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                handleEvent(currentEvent, parsed, setState)
              } catch {
                // Skip malformed JSON
              }
              currentEvent = ""
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : String(err),
          }))
        }
      } finally {
        setState((s) => ({ ...s, isStreaming: false }))
        // Invalidate messages to pick up the saved final message
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.root })
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
      }
    },
    [agentId, state.isStreaming, queryClient],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((s) => ({ ...s, isStreaming: false }))
  }, [])

  // D22: Retry last message after error
  const lastMessageRef = useRef<string | null>(null)
  // Track last message inside send
  const originalSend = send
  const wrappedSend = useCallback(
    (message: string) => {
      lastMessageRef.current = message
      return originalSend(message)
    },
    [originalSend],
  )

  const retry = useCallback(() => {
    if (lastMessageRef.current && !state.isStreaming) {
      setState(INITIAL_STATE)
      wrappedSend(lastMessageRef.current)
    }
  }, [state.isStreaming, wrappedSend])

  return { ...state, send: wrappedSend, cancel, retry }
}

function handleEvent(
  event: string,
  data: Record<string, unknown>,
  setState: React.Dispatch<React.SetStateAction<StreamingState>>,
) {
  switch (event) {
    case "session":
      setState((s) => ({
        ...s,
        sessionId: data.sessionId as string,
      }))
      break

    case "chunk": {
      const chunk = data as unknown as StreamChunk
      switch (chunk.type) {
        case "text_delta":
          setState((s) => ({
            ...s,
            streamedText: s.streamedText + (chunk.content ?? ""),
          }))
          break
        case "text":
          // Final aggregated text — replace accumulated deltas
          setState((s) => ({
            ...s,
            streamedText: chunk.content ?? s.streamedText,
          }))
          break
        case "tool_call":
          setState((s) => ({
            ...s,
            activeToolCalls: [
              ...s.activeToolCalls,
              { tool: chunk.tool ?? "unknown", params: chunk.params },
            ],
          }))
          break
        case "tool_result":
          setState((s) => ({
            ...s,
            activeToolCalls: s.activeToolCalls.filter((tc) => tc.tool !== chunk.tool),
            toolResults: [
              ...s.toolResults,
              { tool: chunk.tool ?? "unknown", content: chunk.content ?? "" },
            ],
          }))
          break
        case "error":
          setState((s) => ({
            ...s,
            error: chunk.content ?? "Unknown error",
          }))
          break
      }
      break
    }

    case "done":
      setState((s) => ({ ...s, isStreaming: false }))
      break

    case "error":
      setState((s) => ({
        ...s,
        error: (data.error as string) ?? "Stream error",
        isStreaming: false,
      }))
      break
  }
}
