import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  PaperPlaneRightIcon,
  ProhibitIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

interface SessionActionsProps {
  agentId: string
  agentName: string
}

export function SessionActions({ agentId, agentName }: SessionActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  // Send DM message to agent (queued for next session)
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Send to agent's DM channel (convention: dm-{agentId})
      const dmChannelId = `dm-${agentId}`
      const res = await api.api.channels[":id"].messages.$post({
        param: { id: dmChannelId },
        json: { content },
      })
      if (!res.ok) {
        // If DM channel doesn't exist, try creating it first
        const createRes = await api.api.channels.$post({
          json: {
            name: `DM: ${agentName}`,
            type: "direct" as const,
            members: [
              { actor_id: agentId, actor_type: "agent" as const },
            ],
          },
        })
        if (!createRes.ok) throw new Error("Failed to create DM channel")
        // Retry sending
        const retryRes = await api.api.channels[":id"].messages.$post({
          param: { id: dmChannelId },
          json: { content },
        })
        if (!retryRes.ok) throw new Error("Failed to send message")
      }
    },
    onSuccess: () => {
      toast.success(t("team.session_message_sent"))
      setMessage("")
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  // Add blocker to current task
  const addBlockerMutation = useMutation({
    mutationFn: async () => {
      // This would need the current task ID — for now, we use the activity
      // to find the current task. Simplified: send as DM instruction.
      const dmChannelId = `dm-${agentId}`
      const res = await api.api.channels[":id"].messages.$post({
        param: { id: dmChannelId },
        json: { content: `[BLOCKER] ${message || "Task blocked by human intervention"}` },
      })
      if (!res.ok) throw new Error("Failed to add blocker")
    },
    onSuccess: () => {
      toast.success(t("team.session_blocker_added"))
      setMessage("")
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  function handleSendMessage() {
    if (!message.trim()) return
    sendMessageMutation.mutate(message.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[10px]"
          onClick={() => {
            if (message.trim()) {
              addBlockerMutation.mutate()
            }
          }}
          disabled={addBlockerMutation.isPending}
        >
          <ProhibitIcon size={12} />
          {t("team.session_add_blocker")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5 text-[10px]"
          onClick={() => setCancelDialogOpen(true)}
        >
          <XCircleIcon size={12} />
          {t("team.session_cancel")}
        </Button>
      </div>

      {/* Message input */}
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("team.session_message_placeholder", { name: agentName })}
          className="text-xs"
        />
        <Button
          size="icon-sm"
          onClick={handleSendMessage}
          disabled={!message.trim() || sendMessageMutation.isPending}
        >
          <PaperPlaneRightIcon size={14} />
        </Button>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.session_cancel")}</DialogTitle>
            <DialogDescription>
              {t("team.session_cancel_confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCancelDialogOpen(false)
                toast.success(t("team.session_cancelled"))
              }}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
