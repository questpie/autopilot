import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { dashboardGroupsQuery } from "./dashboard.queries"
import { AlertsSection } from "./alerts-section"
import { AgentsSection } from "./agents-section"
import { PinsSection } from "./pins-section"
import { ActivitySection } from "./activity-section"
import { WidgetLoader } from "./widget-loader"
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
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.normal,
        ease: EASING.enter,
        delay: shouldReduce ? 0 : clampedDelay(index, 50, 400),
      }}
    >
      {children}
    </motion.div>
  )
}

export function DashboardGroups() {
  const { data } = useQuery(dashboardGroupsQuery)
  const { shouldReduce } = useMotionPreference()
  const groups = (data as { groups: Array<{ id: string; title: string; position: number }> })?.groups ?? []

  // If no groups defined, render default order
  if (groups.length === 0) {
    const defaults = [AlertsSection, AgentsSection, PinsSection, WidgetLoader, ActivitySection]
    return (
      <div className="flex flex-col gap-8">
        {defaults.map((Section, i) => (
          <StaggerSection key={i} index={i} shouldReduce={shouldReduce}>
            <Section />
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
              <BuiltIn />
            </StaggerSection>
          )
        }
        return null
      })}
      <StaggerSection index={sorted.length} shouldReduce={shouldReduce}>
        <WidgetLoader />
      </StaggerSection>
    </div>
  )
}
