import { useRef, useCallback, type ReactNode } from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { useDrag } from "@use-gesture/react"
import { MinusIcon } from "@phosphor-icons/react"

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Snap points as fractions of viewport height (default: [0.5, 0.92]) */
  snapPoints?: number[]
  /** Dismiss threshold as fraction of viewport height (default: 0.25) */
  dismissThreshold?: number
  className?: string
}

/**
 * Mobile bottom sheet with drag handle, snap points, and dismiss gesture.
 * Uses @use-gesture/react for drag interactions.
 * Snap points default to 50% and 92% of viewport height.
 * Dismisses when dragged below 25% threshold.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  snapPoints = [0.5, 0.92],
  dismissThreshold = 0.25,
  className,
}: BottomSheetProps) {
  const shouldReduce = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const currentSnap = useRef(0)

  const getSnapHeight = useCallback(
    (index: number) => {
      const vh = window.innerHeight
      const snap = snapPoints[index] ?? snapPoints[0] ?? 0.5
      return vh * snap
    },
    [snapPoints],
  )

  const bind = useDrag(
    ({ movement: [, my], last, velocity: [, vy] }) => {
      if (!sheetRef.current) return

      const vh = window.innerHeight
      const currentHeight = getSnapHeight(currentSnap.current)
      const newHeight = currentHeight - my

      if (last) {
        // Dismiss if below threshold
        if (newHeight < vh * dismissThreshold || (vy > 0.5 && my > 0)) {
          onClose()
          return
        }

        // Snap to nearest point
        let closestSnap = 0
        let closestDist = Infinity
        for (let i = 0; i < snapPoints.length; i++) {
          const snapHeight = vh * (snapPoints[i] ?? 0.5)
          const dist = Math.abs(newHeight - snapHeight)
          if (dist < closestDist) {
            closestDist = dist
            closestSnap = i
          }
        }
        currentSnap.current = closestSnap
        sheetRef.current.style.height = `${getSnapHeight(closestSnap)}px`
        sheetRef.current.style.transition = "height 0.3s ease"
        return
      }

      // During drag, update height directly
      sheetRef.current.style.transition = "none"
      sheetRef.current.style.height = `${Math.max(0, newHeight)}px`
    },
    {
      axis: "y",
      filterTaps: true,
      from: () => [0, 0],
    },
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduce ? 0 : 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <m.div
            ref={sheetRef}
            initial={{
              y: shouldReduce ? 0 : "100%",
              opacity: shouldReduce ? 1 : 0,
            }}
            animate={{ y: 0, opacity: 1 }}
            exit={{
              y: shouldReduce ? 0 : "100%",
              opacity: shouldReduce ? 1 : 0,
            }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              duration: shouldReduce ? 0 : undefined,
            }}
            style={{ height: getSnapHeight(0) }}
            className={[
              "fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden border-t border-border bg-background lg:hidden",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-modal="true"
          >
            {/* Drag handle */}
            <div
              {...bind()}
              className="flex cursor-grab items-center justify-center py-3 active:cursor-grabbing"
              style={{ touchAction: "none" }}
            >
              <MinusIcon
                size={32}
                weight="bold"
                className="text-muted-foreground/50"
                aria-hidden="true"
              />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 pb-4">{children}</div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
