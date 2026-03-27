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

// ── Spring Presets ──
// For gestures, drag, and physics-based motion.
export const SPRING = {
  /** Quick settle — drag drops, button feedback */
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  /** Noticeable bounce — notifications, empty state icon */
  bouncy: { type: "spring" as const, stiffness: 300, damping: 20 },
  /** Soft settle — page transitions, cards */
  gentle: { type: "spring" as const, stiffness: 200, damping: 25 },
  /** Apple-style — drawers, sheets */
  apple: { type: "spring" as const, duration: 0.5, bounce: 0.2 },
} as const

// ── Stagger Helper ──
// Max total stagger under 300ms.
export function staggerTransition(perItem = 0.03) {
  return {
    staggerChildren: perItem,
    delayChildren: 0,
    ...(perItem > 0 ? { staggerDirection: 1 as const } : {}),
  }
}

/** Clamp stagger delay so total never exceeds maxMs */
export function clampedDelay(index: number, perItemMs = 30, maxTotalMs = 300): number {
  const delay = index * perItemMs
  return Math.min(delay, maxTotalMs) / 1000
}

// ── Common Variants ──
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
} as const

// ── Reduced variants (no motion) ──
export const staticVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
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

// ── Haptic Patterns ──
// Vibration patterns for different feedback types.
// Single number = duration in ms. Array = pattern [vibrate, pause, vibrate, ...].
export const HAPTIC_PATTERN = {
  /** Subtle tap — default for most interactions */
  tap: 5,
  /** Success confirmation — approve, send, complete */
  success: [10, 50, 10] as number[],
  /** Error/reject feedback */
  error: [50, 30, 50, 30, 50] as number[],
  /** Heavy press — destructive action confirm */
  heavy: 30,
} as const
