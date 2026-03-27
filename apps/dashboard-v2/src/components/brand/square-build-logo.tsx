import { motion, useReducedMotion } from "framer-motion"
import { t } from "@/lib/i18n"

interface SquareBuildLogoProps {
  size?: number
  className?: string
}

/**
 * SquareBuild logo animation.
 * L-path draws on via stroke-dashoffset (600ms),
 * then purple square slides in from bottom-right (300ms, 400ms delay).
 * Respects prefers-reduced-motion.
 */
export function SquareBuildLogo({
  size = 48,
  className,
}: SquareBuildLogoProps) {
  const shouldReduceMotion = useReducedMotion()

  // L-path total length (approximation for the SVG path)
  const pathLength = 120

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={t("a11y.brand_logo")}
    >
      {/* L-path */}
      <motion.path
        d="M8 8 L8 40 L32 40"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="square"
        fill="none"
        initial={
          shouldReduceMotion
            ? { strokeDashoffset: 0 }
            : { strokeDashoffset: pathLength }
        }
        animate={{ strokeDashoffset: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.6, ease: "easeInOut" }
        }
        style={{ strokeDasharray: pathLength }}
      />

      {/* Purple square */}
      <motion.rect
        x={28}
        y={20}
        width={14}
        height={14}
        fill="var(--color-primary)"
        initial={
          shouldReduceMotion
            ? { x: 28, y: 20, opacity: 1 }
            : { x: 48, y: 40, opacity: 0 }
        }
        animate={{ x: 28, y: 20, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.3, delay: 0.4, ease: "easeOut" }
        }
      />
    </svg>
  )
}
