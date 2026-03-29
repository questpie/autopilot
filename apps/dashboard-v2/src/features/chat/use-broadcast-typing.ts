import { useCallback, useRef } from "react"
import { API_BASE } from "@/lib/api"

const DEBOUNCE_MS = 3_000

/**
 * Hook that broadcasts a "user is typing" event to the channel.
 * Debounced: only sends one POST per 3 seconds regardless of how
 * many keystrokes occur.
 */
export function useBroadcastTyping(channelId: string) {
  const lastSentRef = useRef(0)

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastSentRef.current < DEBOUNCE_MS) return

    lastSentRef.current = now
    fetch(`${API_BASE}/api/channels/${encodeURIComponent(channelId)}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: "{}",
    }).catch(() => {
      // Typing events are best-effort — ignore failures
    })
  }, [channelId])

  return { notifyTyping }
}
