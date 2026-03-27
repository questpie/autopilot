import { motion, useReducedMotion } from "framer-motion"
import { t } from "@/lib/i18n"

interface QuestPieSpinnerProps {
  size?: 16 | 24 | 32
  className?: string
}

/**
 * QUESTPIE spinner — purple square orbits around the L-path center.
 * Rotates 360deg in 1.2s linear infinite.
 * Used in full-page loading (32px), button loading (16px).
 * Respects prefers-reduced-motion (shows static square).
 */
export function QuestPieSpinner({
  size = 32,
  className,
}: QuestPieSpinnerProps) {
  const shouldReduceMotion = useReducedMotion()

  const squareSize = size * 0.3
  const orbitRadius = size * 0.25
  const center = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="status"
      aria-label={t("a11y.loading")}
    >
      {/* Static L-path (faint) */}
      <path
        d={`M${size * 0.17} ${size * 0.17} L${size * 0.17} ${size * 0.83} L${size * 0.67} ${size * 0.83}`}
        stroke="currentColor"
        strokeWidth={size * 0.06}
        strokeLinecap="square"
        opacity={0.15}
      />

      {/* Orbiting purple square */}
      <motion.g
        animate={
          shouldReduceMotion ? undefined : { rotate: 360 }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 1.2, repeat: Infinity, ease: "linear" }
        }
        style={{ originX: `${center}px`, originY: `${center}px` }}
      >
        <rect
          x={center - squareSize / 2}
          y={center - orbitRadius - squareSize / 2}
          width={squareSize}
          height={squareSize}
          fill="var(--color-primary)"
        />
      </motion.g>
    </svg>
  )
}
