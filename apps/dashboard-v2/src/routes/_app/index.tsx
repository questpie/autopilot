import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { DashboardGroups } from "@/features/dashboard/dashboard-groups"
import { PageTransition } from "@/components/layouts/page-transition"

export const Route = createFileRoute("/_app/")({ component: DashboardHome })

function DashboardHome() {
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-1 flex-col gap-8 p-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {t("dashboard.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.welcome")}
        </p>
      </div>

      {/* Dashboard sections (ordered by groups.yaml or defaults) */}
      <DashboardGroups />
    </PageTransition>
  )
}
