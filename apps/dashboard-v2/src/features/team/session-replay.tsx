import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { SessionEvent } from "./session-event-item"
import { api } from "@/lib/api"

/**
 * Parse JSONL session log data into SessionEvent array.
 */
function parseSessionLog(content: string, agentId: string): SessionEvent[] {
  const lines = content.split("\n").filter((line) => line.trim())
  const events: SessionEvent[] = []

  for (let i = 0; i < lines.length; i++) {
    try {
      const raw = JSON.parse(lines[i]) as Record<string, unknown>
      events.push({
        id: `replay-${i}`,
        type: mapRawType(raw.type as string | undefined, raw.tool as string | undefined),
        timestamp: (raw.at as string) ?? (raw.timestamp as string) ?? new Date().toISOString(),
        content: (raw.content as string) ?? (raw.summary as string) ?? "",
        toolName: (raw.tool as string) ?? (raw.toolName as string),
        filePath: (raw.path as string) ?? ((raw.details as Record<string, string> | undefined)?.path),
        diff: (raw.diff as string) ?? ((raw.details as Record<string, string> | undefined)?.diff),
        lineCount: (raw.lineCount as number) ?? ((raw.details as Record<string, number> | undefined)?.lineCount),
        agentId,
      })
    } catch {
      // Skip malformed lines
    }
  }

  return events
}

function mapRawType(type?: string, tool?: string): SessionEvent["type"] {
  if (type === "thinking" || type === "plan") return "thinking"
  if (type === "error") return "error"
  if (type === "text" || type === "message") return "text"
  if (type === "tool_result" || type === "result") return "tool_result"
  if (tool || type === "tool_call") return "tool_call"
  return "text"
}

/**
 * Hook to load session replay data from JSONL log file.
 */
export function useSessionReplay(agentId: string, sessionId: string) {
  const query = useQuery({
    queryKey: queryKeys.sessions.detail(sessionId),
    queryFn: async () => {
      // Try to load session log from filesystem API
      const res = await api.api.fs[":path{.+}"].$get({
        param: { path: `logs/sessions/${sessionId}.jsonl` },
      })
      if (!res.ok) {
        // Fallback: try the activity API filtered by agent
        const actRes = await api.api.activity.$get({
          query: { agent: agentId, limit: "100" },
        })
        if (!actRes.ok) throw new Error("Failed to load session data")
        const activities = (await actRes.json()) as Array<Record<string, unknown>>
        return activities.map((a, i) => ({
          id: `activity-${i}`,
          type: mapRawType(a.type as string, a.toolName as string),
          timestamp: (a.at as string) ?? new Date().toISOString(),
          content: (a.summary as string) ?? "",
          toolName: a.toolName as string | undefined,
          filePath: (a.details as Record<string, string> | undefined)?.path,
          agentId,
        })) as SessionEvent[]
      }
      const text = await res.text()
      return parseSessionLog(text, agentId)
    },
    enabled: !!sessionId && !!agentId,
  })

  return query
}

/**
 * Hook to list available sessions for an agent.
 */
export function useSessionList(agentId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.list({ agent: agentId }),
    queryFn: async () => {
      // Try to list session logs from filesystem
      const res = await api.api.fs[":path{.+}"].$get({
        param: { path: "logs/sessions/" },
      })
      if (!res.ok) return [] as Array<{ id: string; name: string }>

      const files = (await res.json()) as Array<{ name: string; path: string }>
      return files
        .filter((f) => f.name.includes(agentId) && f.name.endsWith(".jsonl"))
        .map((f) => ({
          id: f.name.replace(".jsonl", ""),
          name: f.name,
        }))
    },
    enabled: !!agentId,
  })
}
