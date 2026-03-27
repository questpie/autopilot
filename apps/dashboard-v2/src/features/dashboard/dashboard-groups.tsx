import { useQuery } from "@tanstack/react-query"
import { dashboardGroupsQuery } from "./dashboard.queries"
import { AlertsSection } from "./alerts-section"
import { AgentsSection } from "./agents-section"
import { PinsSection } from "./pins-section"
import { ActivitySection } from "./activity-section"
import { WidgetLoader } from "./widget-loader"

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
export function DashboardGroups() {
  const { data } = useQuery(dashboardGroupsQuery)
  const groups = (data as { groups: Array<{ id: string; title: string; position: number }> })?.groups ?? []

  // If no groups defined, render default order
  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <AlertsSection />
        <AgentsSection />
        <PinsSection />
        <WidgetLoader />
        <ActivitySection />
      </div>
    )
  }

  // Sort groups by position
  const sorted = [...groups].sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col gap-8">
      {sorted.map((group) => {
        const BuiltIn = BUILT_IN_SECTIONS[group.id]
        if (BuiltIn) {
          return <BuiltIn key={group.id} />
        }
        // Custom groups could contain widgets or other content
        return null
      })}
      {/* Always render widgets at the end if not in groups */}
      <WidgetLoader />
    </div>
  )
}
