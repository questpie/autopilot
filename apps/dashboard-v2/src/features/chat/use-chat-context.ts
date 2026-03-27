import { useMemo } from "react"
import { useMatches } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"

export interface ChatContext {
  /** Type of context */
  type: "task" | "dm" | "file" | "channel" | null
  /** Channel or thread ID to display */
  channelId: string | null
  /** Label for the context tab */
  label: string | null
  /** Whether the context tab should be visible */
  visible: boolean
}

/**
 * Determines the contextual chat based on the current route.
 * Rules per spec section 14.4.
 */
export function useChatContext(): ChatContext {
  const { t } = useTranslation()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? "/"

  return useMemo((): ChatContext => {
    // /settings/* → no context
    if (currentPath.startsWith("/settings")) {
      return { type: null, channelId: null, label: null, visible: false }
    }

    // /tasks/:id → task thread
    const taskMatch = currentPath.match(/^\/tasks\/([^/]+)$/)
    if (taskMatch) {
      const taskId = taskMatch[1]
      return {
        type: "task",
        channelId: `task-${taskId}`,
        label: t("chat.context_task_thread", { id: taskId }),
        visible: true,
      }
    }

    // /team/:id → DM with agent
    const teamMatch = currentPath.match(/^\/team\/([^/]+)$/)
    if (teamMatch) {
      const agentId = teamMatch[1]
      return {
        type: "dm",
        channelId: `dm-${agentId}`,
        label: t("chat.context_dm", { name: agentId }),
        visible: true,
      }
    }

    // /team/:id/session → DM with agent
    const sessionMatch = currentPath.match(/^\/team\/([^/]+)\/session/)
    if (sessionMatch) {
      const agentId = sessionMatch[1]
      return {
        type: "dm",
        channelId: `dm-${agentId}`,
        label: t("chat.context_dm", { name: agentId }),
        visible: true,
      }
    }

    // /files/* → messages about file
    const fileMatch = currentPath.match(/^\/files\/(.+)$/)
    if (fileMatch) {
      const filePath = fileMatch[1]
      const fileName = filePath.split("/").pop() ?? filePath
      return {
        type: "file",
        channelId: null, // File context uses search, not a specific channel
        label: t("chat.context_file", { name: fileName }),
        visible: true,
      }
    }

    // /artifacts/:id → messages about artifact
    const artifactMatch = currentPath.match(/^\/artifacts\/([^/]+)$/)
    if (artifactMatch) {
      return {
        type: "channel",
        channelId: null,
        label: t("chat.context_file", { name: artifactMatch[1] }),
        visible: true,
      }
    }

    // / (dashboard) → #general
    if (currentPath === "/") {
      return {
        type: "channel",
        channelId: "general",
        label: t("chat.context_channel", { name: "general" }),
        visible: true,
      }
    }

    // Default: no specific context
    return { type: null, channelId: null, label: null, visible: false }
  }, [currentPath, t])
}
