import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDeleteMessage } from "./chat.mutations"
import { useChatUIStore } from "./chat-ui.store"
import { memo, useCallback } from "react"

interface DeleteMessageDialogProps {
  channelId: string
}

export const DeleteMessageDialog = memo(function DeleteMessageDialog({ channelId }: DeleteMessageDialogProps) {
  const deletingMessageId = useChatUIStore((s) => s.deletingMessageId)
  const setDeletingMessageId = useChatUIStore((s) => s.setDeletingMessageId)
  const deleteMessage = useDeleteMessage(channelId)

  const open = !!deletingMessageId

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setDeletingMessageId(null)
    },
    [setDeletingMessageId],
  )

  const handleCancel = useCallback(() => setDeletingMessageId(null), [setDeletingMessageId])

  const handleDelete = useCallback(() => {
    if (!deletingMessageId) return
    deleteMessage.mutate(deletingMessageId, {
      onSuccess: () => setDeletingMessageId(null),
    })
  }, [deletingMessageId, deleteMessage, setDeletingMessageId])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete Message</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this message? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleteMessage.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
