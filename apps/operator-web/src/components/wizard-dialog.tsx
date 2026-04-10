import { useCallback, useEffect, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { DURATION, EASING } from '@/lib/motion'

// ── Types ──

interface WizardDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

// ── WizardField ──

export function WizardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-heading text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Input style constants ──

export const wizardInputClass =
  'w-full rounded-none bg-input/30 border border-border text-foreground text-[14px] p-2 outline-none transition-colors focus:border-primary'

export const wizardTextareaClass =
  'w-full rounded-none bg-input/30 border border-border text-foreground text-[14px] p-2 outline-none transition-colors focus:border-primary min-h-[80px] resize-y'

export const wizardSelectClass =
  'w-full rounded-none bg-input/30 border border-border text-foreground text-[14px] p-2 outline-none transition-colors focus:border-primary appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M3%204.5L6%208l3-3.5%22%2F%3E%3C%2Fsvg%3E")] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7'

// ── WizardDialog ──

export function WizardDialog({ open, onClose, title, children, actions }: WizardDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.normal }}
          onClick={handleOverlayClick}
        >
          <m.div
            ref={panelRef}
            className="w-[480px] max-w-[90vw] rounded-xl border border-border bg-card p-6"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: DURATION.slow, ease: EASING.enter }}
          >
            <h2 className="mb-4 text-[16px] font-bold">{title}</h2>
            <div className="flex flex-col gap-3">{children}</div>
            {actions && (
              <div className="mt-4 flex items-center justify-end gap-2">{actions}</div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
