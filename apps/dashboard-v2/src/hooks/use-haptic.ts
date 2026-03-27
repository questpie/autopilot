export { useHaptic } from "use-haptic"

import { useCallback } from "react"
import { useReducedMotion } from "framer-motion"
import { useHaptic } from "use-haptic"
import { HAPTIC_PATTERN } from "@/lib/motion"

type PatternName = keyof typeof HAPTIC_PATTERN

export function useHapticPattern() {
  const { triggerHaptic } = useHaptic()
  const shouldReduce = useReducedMotion()

  const trigger = useCallback(
    (pattern: PatternName = "tap") => {
      if (shouldReduce) return
      const value = HAPTIC_PATTERN[pattern]
      if (typeof value === "number") {
        // Single duration — use the base hook
        triggerHaptic()
      } else if (Array.isArray(value) && typeof navigator !== "undefined" && navigator.vibrate) {
        // Pattern array — use Vibration API directly
        navigator.vibrate(value)
      } else {
        // Fallback
        triggerHaptic()
      }
    },
    [triggerHaptic, shouldReduce],
  )

  return { trigger, triggerHaptic }
}
