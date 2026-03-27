import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AnimatedSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  side?: "right" | "left"
  width?: number
  className?: string
}

/**
 * Animated sheet overlay with translateX open/close.
 * Open: translateX(width->0) over 300ms
 * Close: translateX(0->width) over 200ms
 * Respects prefers-reduced-motion.
 */
export function AnimatedSheet({
  open,
  onClose,
  children,
  side = "right",
  width = 360,
  className,
}: AnimatedSheetProps) {
  const shouldReduce = useReducedMotion()
  const xOffset = side === "right" ? width : -width

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduce ? 0 : 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            initial={{ x: shouldReduce ? 0 : xOffset }}
            animate={{ x: 0 }}
            exit={{ x: shouldReduce ? 0 : xOffset }}
            transition={{
              type: "tween",
              duration: shouldReduce ? 0 : 0.3,
            }}
            className={cn(
              "fixed top-0 z-50 flex h-full max-w-[100vw] flex-col border-border bg-background pt-[var(--safe-top)]",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
              className,
            )}
            style={{ width }}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
