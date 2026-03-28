import { useRef, type ReactNode } from "react"
import {
  m,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
} from "framer-motion"
import { useDrag } from "@use-gesture/react"
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { useHapticPattern } from "@/hooks/use-haptic"
import { SPRING } from "@/lib/motion"

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
 * Uses exponential boundary damping instead of hard clamp.
 * Springs back with physics-based animation.
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
  const { trigger: haptic } = useHapticPattern()
  const shouldReduce = useReducedMotion()
  const x = useMotionValue(0)
  const dragRef = useRef<HTMLDivElement>(null)

  // Background opacity based on drag distance
  const rightBgOpacity = useTransform(x, [0, revealThreshold, triggerThreshold], [0, 0.3, 1])
  const leftBgOpacity = useTransform(x, [-triggerThreshold, -revealThreshold, 0], [1, 0.3, 0])

  // Exponential boundary damping: max * (1 - exp(-offset / max))
  function dampedValue(offset: number, max: number): number {
    return max * (1 - Math.exp(-Math.abs(offset) / max)) * Math.sign(offset)
  }

  useDrag(
    ({ movement: [mx], last, velocity: [vx] }) => {
      if (shouldReduce) return

      if (last) {
        // Check if trigger threshold reached
        if (mx > triggerThreshold || (mx > revealThreshold && vx > 0.5)) {
          if (onSwipeRight) {
            haptic("success")
            onSwipeRight()
          }
        } else if (mx < -triggerThreshold || (mx < -revealThreshold && vx < -0.5)) {
          if (onSwipeLeft) {
            haptic("error")
            onSwipeLeft()
          }
        }
        // Spring back with physics
        void animate(x, 0, SPRING.snappy)
        return
      }

      // Apply exponential damping beyond trigger threshold
      const maxDrag = triggerThreshold * 1.5
      const damped = dampedValue(mx, maxDrag)
      x.set(damped)
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
        <m.div
          style={{ opacity: rightBgOpacity }}
          className="absolute inset-0 flex items-center justify-start bg-green-600 px-6"
        >
          <CheckCircleIcon size={24} className="text-white" aria-hidden="true" />
          <span className="ml-2 font-heading text-sm font-semibold text-white">
            {rightLabel ?? t("inbox.approve")}
          </span>
        </m.div>
      )}

      {/* Left swipe background (reject - red) */}
      {onSwipeLeft && (
        <m.div
          style={{ opacity: leftBgOpacity }}
          className="absolute inset-0 flex items-center justify-end bg-red-600 px-6"
        >
          <span className="mr-2 font-heading text-sm font-semibold text-white">
            {leftLabel ?? t("inbox.reject")}
          </span>
          <XCircleIcon size={24} className="text-white" aria-hidden="true" />
        </m.div>
      )}

      {/* Draggable content */}
      <m.div
        ref={dragRef}
        style={{ x, touchAction: "pan-y" }}
        className="relative z-10 bg-background"
      >
        {children}
      </m.div>
    </div>
  )
}
