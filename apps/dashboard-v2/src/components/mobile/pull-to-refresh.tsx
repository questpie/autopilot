import { useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useDrag } from "@use-gesture/react"
import { QuestPieSpinner } from "@/components/brand/questpie-spinner"

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void>
  /** Minimum pull distance in px to trigger refresh (default: 80) */
  threshold?: number
  className?: string
}

/**
 * Pull-to-refresh wrapper using custom QUESTPIE spinner.
 * Drag down from top of scrollable area to trigger.
 * Shows spinner while refreshing.
 */
export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className,
}: PullToRefreshProps) {
  const shouldReduce = useReducedMotion()
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ movement: [, my], last, first }) => {
      // Only allow pull when at top of scroll
      if (first && scrollRef.current && scrollRef.current.scrollTop > 0) {
        return
      }

      if (refreshing) return

      if (last) {
        if (my >= threshold) {
          setRefreshing(true)
          setPullDistance(threshold / 2)
          void onRefresh().finally(() => {
            setRefreshing(false)
            setPullDistance(0)
          })
        } else {
          setPullDistance(0)
        }
        return
      }

      if (my > 0) {
        // Dampen pull distance
        const dampened = Math.min(my * 0.5, threshold * 1.5)
        setPullDistance(dampened)
      }
    },
    {
      axis: "y",
      filterTaps: true,
      from: () => [0, 0],
    },
  )

  const showSpinner = pullDistance > 0 || refreshing
  const spinnerOpacity = refreshing ? 1 : Math.min(pullDistance / threshold, 1)

  return (
    <div className={["relative overflow-hidden", className].filter(Boolean).join(" ")}>
      {/* Spinner area */}
      {showSpinner && (
        <motion.div
          initial={false}
          animate={{
            height: shouldReduce ? (refreshing ? 48 : 0) : pullDistance,
            opacity: spinnerOpacity,
          }}
          transition={{ duration: shouldReduce ? 0 : 0.15 }}
          className="flex items-center justify-center overflow-hidden"
        >
          <QuestPieSpinner size={24} />
        </motion.div>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        {...bind()}
        className="flex-1 overflow-auto"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  )
}
