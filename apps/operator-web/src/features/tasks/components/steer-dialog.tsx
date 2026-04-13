import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSteerRun } from '@/hooks/use-runs'

interface SteerDialogProps {
  open: boolean
  onClose: () => void
  runId: string
}

export function SteerDialog({ open, onClose, runId }: SteerDialogProps) {
  const [message, setMessage] = useState('')
  const steer = useSteerRun()

  function handleSend() {
    if (!message.trim()) return
    steer.mutate(
      { runId, message: message.trim() },
      {
        onSuccess: () => {
          setMessage('')
          onClose()
        },
      },
    )
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMessage('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs uppercase tracking-widest">
            Steer Run
          </DialogTitle>
        </DialogHeader>
        <Textarea
          className="rounded-none font-mono text-xs"
          placeholder="Send a steering message to the running agent…"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSend()
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button
            variant="default"
            size="sm"
            disabled={!message.trim() || steer.isPending}
            loading={steer.isPending}
            onClick={handleSend}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
