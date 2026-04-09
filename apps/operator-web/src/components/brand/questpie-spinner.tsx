import {
  m,
  useAnimate,
  useMotionValue,
  animate as animateMV,
  useReducedMotion,
} from "framer-motion"
import { useEffect } from "react"
import { t } from "@/lib/i18n"

interface QUESTPIESpinnerProps {
  size?: number
  className?: string
}

const EASE = [0.25, 1, 0.5, 1] as const

/**
 * QUESTPIE spinner — SquareBuildLogo animation looping:
 *   build   → arms draw from (2,2), square grows from seed
 *   pause   → hold fully composed
 *   unbuild → square shrinks back to seed, arms erase
 *   pause   → hold blank, repeat
 * Respects prefers-reduced-motion (shows static logo).
 */
export function QUESTPIESpinner({ size = 32, className }: QUESTPIESpinnerProps) {
  const shouldReduceMotion = useReducedMotion()

  // paths via useAnimate (pathLength works fine with selector)
  const [scope, animateEl] = useAnimate()

  // rect via motion values (avoids x/y CSS-transform conflict on SVG attrs)
  const sqX = useMotionValue(21)
  const sqY = useMotionValue(21)
  const sqW = useMotionValue(2)
  const sqH = useMotionValue(2)
  const sqOpacity = useMotionValue(0)

  useEffect(() => {
    if (shouldReduceMotion) return

    let cancelled = false

    const reset = () => {
      sqX.set(21); sqY.set(21); sqW.set(2); sqH.set(2); sqOpacity.set(0)
      animateEl("path", { pathLength: 0 }, { duration: 0 })
    }

    const buildRect = (opts: object) =>
      Promise.all([
        animateMV(sqX, 13, opts),
        animateMV(sqY, 13, opts),
        animateMV(sqW, 10, opts),
        animateMV(sqH, 10, opts),
        animateMV(sqOpacity, 1, opts),
      ])

    const unBuildRect = (opts: object) =>
      Promise.all([
        animateMV(sqX, 21, opts),
        animateMV(sqY, 21, opts),
        animateMV(sqW, 2, opts),
        animateMV(sqH, 2, opts),
        animateMV(sqOpacity, 0, opts),
      ])

    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const runLoop = async () => {
      reset()

      while (!cancelled) {
        // build: arms first, square follows
        animateEl("path", { pathLength: 1 }, { duration: 0.6, ease: EASE, delay: 0.1 })
        await buildRect({ duration: 0.6, ease: EASE, delay: 0.2 })
        if (cancelled) break

        await pause(500)
        if (cancelled) break

        // unbuild: square first, arms follow
        unBuildRect({ duration: 0.5, ease: EASE })
        await animateEl("path", { pathLength: 0 }, { duration: 0.5, ease: EASE, delay: 0.1 })
        if (cancelled) break

        await pause(250)
      }
    }

    runLoop()
    return () => { cancelled = true }
  }, [shouldReduceMotion, animateEl, sqX, sqY, sqW, sqH, sqOpacity])

  if (shouldReduceMotion) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        role="status"
        aria-label={t("a11y.loading")}
      >
        <path d="M2 2H22V10" stroke="currentColor" strokeWidth={2} strokeLinecap="square" />
        <path d="M2 2V22H10" stroke="currentColor" strokeWidth={2} strokeLinecap="square" />
        <rect x={13} y={13} width={10} height={10} fill="#B700FF" />
      </svg>
    )
  }

  return (
    <svg
      ref={scope}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="status"
      aria-label={t("a11y.loading")}
    >
      <m.path d="M2 2H22V10" stroke="currentColor" strokeWidth={2} strokeLinecap="square" fill="none" initial={{ pathLength: 0 }} />
      <m.path d="M2 2V22H10" stroke="currentColor" strokeWidth={2} strokeLinecap="square" fill="none" initial={{ pathLength: 0 }} />
      <m.rect
        fill="#B700FF"
        style={{ x: sqX, y: sqY, width: sqW, height: sqH, opacity: sqOpacity }}
      />
    </svg>
  )
}
