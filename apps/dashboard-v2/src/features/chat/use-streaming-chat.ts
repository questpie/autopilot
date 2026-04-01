import { useEffect, useRef } from "react"
import { useSendMessage } from "./chat.mutations"

interface UseStreamingChatOptions {
  channelId: string
  /** When provided, automatically sends this message once on mount. */
  autoStartMessage?: string
}

export function useStreamingChat({
  channelId,
  autoStartMessage,
}: UseStreamingChatOptions) {
  const sendMessage = useSendMessage(channelId)
  const sendRef = useRef(sendMessage)
  sendRef.current = sendMessage

  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (!autoStartMessage || hasFiredRef.current) return
    hasFiredRef.current = true

    sendRef.current.mutate({ content: autoStartMessage })
  }, [autoStartMessage])

  return sendMessage
}
