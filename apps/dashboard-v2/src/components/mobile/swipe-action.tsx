import { useRef, type ReactNode } from "react"
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion"
import { useDrag } from "@use-gesture/react"
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { useHaptic } from "@/hooks/use-haptic"

interface SwipeActionProps {
  children: ReactNode
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  rightLabel?: string
  leftLabel?: string
  /** Pixel distance to reveal action indicator (default: 80) */
  revealThreshold?: number
  /** Pixel distance to trigger action (default: 160) */
  triggerThreshold?: number
  className?: string
}

/**
 * Swipe action wrapper for list items.
 * Swipe right = positive action (green, approve).
 * Swipe left = negative action (red, reject).
 * Reveals at 80px drag, triggers at 160px, springs back if released early.
 * Calls navigator.vibrate(10) on trigger for haptic feedback.
 */
export function SwipeAction({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel,
  leftLabel,
  revealThreshold = 80,
  triggerThreshold = 160,
  className,
}: SwipeActionProps) {
  const { t } = useTranslation()
  const { triggerHaptic } = useHaptic()
  const shouldReduce = useReducedMotion()
  const x = useMotionValue(0)
  const dragRef = useRef<HTMLDivElement>(null)

  // Background opacity based on drag distance
  const rightBgOpacity = useTransform(x, [0, revealThreshold, triggerThreshold], [0, 0.3, 1])
  const leftBgOpacity = useTransform(x, [-triggerThreshold, -revealThreshold, 0], [1, 0.3, 0])

  useDrag(
    ({ movement: [mx], last, velocity: [vx] }) => {
      if (shouldReduce) return

      if (last) {
        // Check if trigger threshold reached
        if (mx > triggerThreshold || (mx > revealThreshold && vx > 0.5)) {
          if (onSwipeRight) {
            triggerHaptic()
            onSwipeRight()
          }
        } else if (mx < -triggerThreshold || (mx < -revealThreshold && vx < -0.5)) {
          if (onSwipeLeft) {
            triggerHaptic()
            onSwipeLeft()
          }
        }
        // Spring back
        x.set(0)
        return
      }

      // Clamp movement to prevent over-drag
      const clamped = Math.max(-triggerThreshold * 1.2, Math.min(triggerThreshold * 1.2, mx))
      x.set(clamped)
    },
    {
      target: dragRef,
      axis: "x",
      filterTaps: true,
      from: () => [x.get(), 0],
    },
  )

  return (
    <div className={["relative overflow-hidden", className].filter(Boolean).join(" ")}>
      {/* Right swipe background (approve - green) */}
      {onSwipeRight && (
        <motion.div
          style={{ opacity: rightBgOpacity }}
          className="absolute inset-0 flex items-center justify-start bg-green-600 px-6"
        >
          <CheckCircleIcon size={24} className="text-white" aria-hidden="true" />
          <span className="ml-2 font-heading text-sm font-semibold text-white">
            {rightLabel ?? t("inbox.approve")}
          </span>
        </motion.div>
      )}

      {/* Left swipe background (reject - red) */}
      {onSwipeLeft && (
        <motion.div
          style={{ opacity: leftBgOpacity }}
          className="absolute inset-0 flex items-center justify-end bg-red-600 px-6"
        >
          <span className="mr-2 font-heading text-sm font-semibold text-white">
            {leftLabel ?? t("inbox.reject")}
          </span>
          <XCircleIcon size={24} className="text-white" aria-hidden="true" />
        </motion.div>
      )}

      {/* Draggable content */}
      <motion.div
        ref={dragRef}
        style={{ x, touchAction: "pan-y" }}
        className="relative z-10 bg-background"
      >
        {children}
      </motion.div>
    </div>
  )
}

