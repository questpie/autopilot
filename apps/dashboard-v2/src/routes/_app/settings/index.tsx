import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "@/lib/i18n"
import { SettingsNav } from "@/features/settings/settings-nav"

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsIndex,
})

/**
 * Settings index redirects to /settings/general.
 * On mobile (where the secondary sidebar is hidden), shows the nav inline.
 */
function SettingsIndex() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    // On desktop, redirect to general. On mobile, the nav renders below.
    const mq = window.matchMedia("(min-width: 768px)")
    if (mq.matches) {
      void navigate({ to: "/settings/general", replace: true })
    }
  }, [navigate])

  return (
    <div className="flex flex-1 flex-col md:hidden">
      <div className="border-b border-border px-4 py-3">
        <h1 className="font-heading text-lg font-semibold">{t("settings.title")}</h1>
      </div>
      <SettingsNav />
    </div>
  )
}
