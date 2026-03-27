import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EASING, DURATION, SPRING, useMotionPreference } from "@/lib/motion"

interface EmptyStateProps {
  icon?: React.ReactNode
  message: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * Empty state component with icon slot, message, description, and action button.
 * Icon bounces in with spring, text staggers with opacity+y.
 */
export function EmptyState({
  icon,
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  const { shouldReduce } = useMotionPreference()

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <motion.div
          initial={shouldReduce ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={shouldReduce ? { duration: 0 } : { ...SPRING.bouncy, duration: 0.5 }}
          className="text-muted-foreground"
        >
          {icon}
        </motion.div>
      )}
      <motion.div
        initial={shouldReduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: shouldReduce ? 0 : DURATION.normal,
          ease: EASING.enter,
          delay: shouldReduce ? 0 : 0.05,
        }}
        className="flex flex-col gap-1"
      >
        <p className="font-heading text-sm font-medium text-foreground">
          {message}
        </p>
        {description && (
          <motion.p
            initial={shouldReduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduce ? 0 : DURATION.normal,
              ease: EASING.enter,
              delay: shouldReduce ? 0 : 0.1,
            }}
            className="max-w-sm text-xs text-muted-foreground"
          >
            {description}
          </motion.p>
        )}
      </motion.div>
      {action && (
        <motion.div
          initial={shouldReduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: shouldReduce ? 0 : DURATION.normal,
            delay: shouldReduce ? 0 : 0.15,
          }}
        >
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </motion.div>
      )}
    </div>
  )
}
