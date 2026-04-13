import { useReducedMotion } from "framer-motion"

// ── Easing Curves ──
// Named curves from ui-animation skill. Never use ease-in for UI entrances.
export const EASING = {
  /** Entrances and transform-based hover */
  enter: [0.22, 1, 0.36, 1] as const,
  /** Slides, drawers, panels */
  move: [0.25, 1, 0.5, 1] as const,
  /** iOS-like drawer */
  drawer: [0.32, 0.72, 0, 1] as const,
} as const

// ── Duration Constants ──
// Asymmetric: enter slightly slower, exit fast.
export const DURATION = {
  /** Button press, tooltip */
  fast: 0.1,
  /** Default transitions */
  normal: 0.2,
  /** Modals, drawers */
  slow: 0.3,
  /** Exit is always faster than enter */
  exitFast: 0.1,
  exitNormal: 0.15,
} as const

// ── Common Variants ──
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const

// ── Reduced variants (no motion) ──
const staticVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
} as const

// ── Stagger Variants (auth screens, lists) ──
export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
} as const

export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
} as const

// ── Motion Preference Hook ──
// Wraps useReducedMotion with typed helpers.
export function useMotionPreference() {
  const shouldReduce = useReducedMotion()

  return {
    shouldReduce: shouldReduce ?? false,
    /** Duration or 0 if reduced motion */
    d: (duration: number) => (shouldReduce ? 0 : duration),
    /** Pick variants based on motion preference */
    variants: <T>(normal: T, reduced: T = staticVariants as T) =>
      shouldReduce ? reduced : normal,
  }
}

