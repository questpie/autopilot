import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router"
import { PageTransition } from "@/components/layouts/page-transition"
import { PageError } from "@/components/feedback"
import { TabsIndicator } from "@/components/ui/tabs"
import { useTranslation } from "@/lib/i18n"
import { LightningIcon, ClockIcon } from "@phosphor-icons/react"
import { LayoutGroup } from "framer-motion"

export const Route = createFileRoute("/_app/observability")({
  component: ObservabilityLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
})

const TAB_ITEMS = [
  {
    labelKey: "nav.activity",
    to: "/observability/activity",
    icon: LightningIcon,
  },
  {
    labelKey: "nav.sessions",
    to: "/observability/sessions",
    icon: ClockIcon,
  },
] as const

function ObservabilityLayout() {
  const { t } = useTranslation()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? ""

  return (
    <PageTransition className="flex flex-1 flex-col">
      <div className="flex flex-col border-b border-border px-6 pt-4">
        <h1 className="font-heading text-2xl font-semibold pb-3">
          {t("observability.title")}
        </h1>

        <nav className="flex" aria-label="Observability tabs">
          <LayoutGroup>
            {TAB_ITEMS.map((item) => {
              const active =
                currentPath === item.to ||
                currentPath.startsWith(item.to + "/")
              const Icon = item.icon

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative inline-flex items-center gap-1.5 px-3 pb-2.5 pt-1 font-heading text-xs font-medium transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={14} weight={active ? "fill" : "regular"} />
                  {t(item.labelKey)}
                  <TabsIndicator
                    layoutId="observability-tab-indicator"
                    active={active}
                    className="bottom-0"
                  />
                </Link>
              )
            })}
          </LayoutGroup>
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </PageTransition>
  )
}
