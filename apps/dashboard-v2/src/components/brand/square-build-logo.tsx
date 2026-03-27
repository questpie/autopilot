import { motion, useReducedMotion } from "framer-motion"
import { t } from "@/lib/i18n"

interface SquareBuildLogoProps {
  size?: number
  className?: string
}

/**
 * SquareBuild logo animation (illustrative / section entrance).
 * 1. Tiny purple seed appears at bottom-right corner (23,23)
 * 2. Two arms fork from top-left corner (2,2) — diagonal opposite of seed
 *    - Right arm: (2,2) → (22,2) → (22,10)
 *    - Down arm:  (2,2) → (2,22) → (10,22)
 * 3. Purple square expands from the seed with a bouncy spring
 * Total duration ~1s. Respects prefers-reduced-motion.
 */
export function SquareBuildLogo({
  size = 24,
  className,
}: SquareBuildLogoProps) {
  const shouldReduceMotion = useReducedMotion()

  const noMotion = shouldReduceMotion

  const ease = { duration: 0.7, ease: [0.25, 1, 0.5, 1] as const }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={t("a11y.brand_logo")}
    >
      {/* Right arm: (2,2) → right along top → down to (22,10) */}
      <motion.path
        d="M2 2H22V10"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="square"
        fill="none"
        initial={noMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          noMotion
            ? { duration: 0 }
            : {
                pathLength: { ...ease, delay: 0.15 },
                opacity: { duration: 0.01, delay: 0.15 },
              }
        }
      />

      {/* Down arm: (2,2) → down along left → right to (10,22) */}
      <motion.path
        d="M2 2V22H10"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="square"
        fill="none"
        initial={noMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          noMotion
            ? { duration: 0 }
            : {
                pathLength: { ...ease, delay: 0.15 },
                opacity: { duration: 0.01, delay: 0.15 },
              }
        }
      />

      {/* Purple square — seed (2×2) at bottom-right corner (21,21)→(23,23),
           grows to full 10×10 at (13,13)→(23,23). Bottom-right corner stays pinned. */}
      <motion.rect
        fill="#B700FF"
        initial={noMotion ? { x: 13, y: 13, width: 10, height: 10 } : { x: 21, y: 21, width: 2, height: 2, opacity: 0 }}
        animate={{ x: 13, y: 13, width: 10, height: 10, opacity: 1 }}
        transition={noMotion ? { duration: 0 } : { ...ease, delay: 0.25 }}
      />
    </svg>
  )
}
