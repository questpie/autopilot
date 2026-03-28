import { m, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
}

const reducedVariants = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1 },
}

/**
 * Page-level transition wrapper.
 * Enter: opacity 0->1 + translateY(8->0) over 200ms
 * Exit: opacity 1->0 over 100ms
 * Children stagger 30ms via staggerChildren.
 * Respects prefers-reduced-motion.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduce = useReducedMotion()

  return (
    <m.div
      variants={shouldReduce ? reducedVariants : variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: shouldReduce ? 0 : 0.2,
        staggerChildren: shouldReduce ? 0 : 0.03,
      }}
      className={className}
    >
      {children}
    </m.div>
  )
}

/**
 * Stagger child wrapper for list items inside PageTransition.
 */
export function StaggerChild({ children, className }: PageTransitionProps) {
  const shouldReduce = useReducedMotion()

  return (
    <m.div
      variants={shouldReduce ? reducedVariants : variants}
      transition={{ duration: shouldReduce ? 0 : 0.2 }}
      className={className}
    >
      {children}
    </m.div>
  )
}
