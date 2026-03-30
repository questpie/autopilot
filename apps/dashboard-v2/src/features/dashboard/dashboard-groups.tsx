import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { m } from "framer-motion"
import { dashboardGroupsQuery } from "./dashboard.queries"
import { AlertsSection } from "./alerts-section"
import { AgentsSection } from "./agents-section"
import { PinsSection } from "./pins-section"
import { ActivitySection } from "./activity-section"
import { WidgetLoader } from "./widget-loader"
import { Skeleton } from "@/components/feedback/skeleton"
import { EASING, DURATION, clampedDelay, useMotionPreference } from "@/lib/motion"

/** Built-in sections that are always available. */
const BUILT_IN_SECTIONS: Record<string, React.ComponentType> = {
  alerts: AlertsSection,
  agents: AgentsSection,
  pinned: PinsSection,
  activity: ActivitySection,
}

/**
 * Renders dashboard sections in order defined by groups.yaml,
 * mixing built-in sections with custom widget sections.
 */
function StaggerSection({
  children,
  index,
  shouldReduce,
}: {
  children: React.ReactNode
  index: number
  shouldReduce: boolean
}) {
  return (
    <m.div
      initial={shouldReduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.normal,
        ease: EASING.enter,
        delay: shouldReduce ? 0 : clampedDelay(index, 50, 400),
      }}
    >
      {children}
    </m.div>
  )
}

export function DashboardGroups() {
  const { data } = useSuspenseQuery(dashboardGroupsQuery)
  const { shouldReduce } = useMotionPreference()
  const groups = (data as { groups: Array<{ id: string; title: string; position: number }> })?.groups ?? []

  const sectionFallback = (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-20 w-full" />
    </div>
  )

  // If no groups defined, render default order
  if (groups.length === 0) {
    const defaults = [AlertsSection, AgentsSection, PinsSection, WidgetLoader, ActivitySection]
    return (
      <div className="flex flex-col gap-8">
        {defaults.map((Section, i) => (
          <StaggerSection key={i} index={i} shouldReduce={shouldReduce}>
            <Suspense fallback={sectionFallback}>
              <Section />
            </Suspense>
          </StaggerSection>
        ))}
      </div>
    )
  }

  // Sort groups by position
  const sorted = [...groups].sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col gap-8">
      {sorted.map((group, i) => {
        const BuiltIn = BUILT_IN_SECTIONS[group.id]
        if (BuiltIn) {
          return (
            <StaggerSection key={group.id} index={i} shouldReduce={shouldReduce}>
              <Suspense fallback={sectionFallback}>
                <BuiltIn />
              </Suspense>
            </StaggerSection>
          )
        }
        return null
      })}
      <StaggerSection index={sorted.length} shouldReduce={shouldReduce}>
        <Suspense fallback={sectionFallback}>
          <WidgetLoader />
        </Suspense>
      </StaggerSection>
    </div>
  )
}
