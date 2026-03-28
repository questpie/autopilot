import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect, useCallback } from "react"
import { BellIcon, MoonIcon } from "@phosphor-icons/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { isPushSubscribed, registerPush, unregisterPush } from "@/lib/push"

export const Route = createFileRoute("/_app/settings/notifications")({
  component: NotificationSettingsPage,
})

// ── Types ───────────────────────────────────────────────────────────────────

type NotifType = "approval_needed" | "blocker" | "mention" | "direct_message" | "task_completed" | "alert"
type Transport = "push"

interface RoutingMatrix {
  [type: string]: {
    [transport: string]: boolean
  }
}

interface QuietHours {
  enabled: boolean
  start: string
  end: string
  timezone: string
  except: string[]
}

const NOTIFICATION_TYPES: { key: NotifType; labelKey: string }[] = [
  { key: "approval_needed", labelKey: "notifications.type_approvals" },
  { key: "blocker", labelKey: "notifications.type_blockers" },
  { key: "mention", labelKey: "notifications.type_mentions" },
  { key: "direct_message", labelKey: "notifications.type_dms" },
  { key: "task_completed", labelKey: "notifications.type_completions" },
  { key: "alert", labelKey: "notifications.type_alerts" },
]

const TRANSPORTS: { key: Transport; labelKey: string }[] = [
  { key: "push", labelKey: "notifications.transport_push" },
]

const DEFAULT_ROUTING: RoutingMatrix = {
  approval_needed: { push: true },
  blocker: { push: true },
  mention: { push: true },
  direct_message: { push: true },
  task_completed: { push: false },
  alert: { push: true },
}

const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: "22:00",
  end: "07:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  except: ["urgent"],
}

// ── Component ───────────────────────────────────────────────────────────────

function NotificationSettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: settingsData, isLoading } = useQuery({
    queryKey: [...queryKeys.notifications.detail("settings")] as string[],
    queryFn: async () => {
      const res = await api.api.settings.$get()
      if (!res.ok) throw new Error("Failed to load settings")
      const json = await res.json()
      return json.settings as Record<string, unknown>
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <SettingsPageHeader
          title={t("notifications.settings_title")}
          description={t("notifications.settings_description")}
        />
        <div className="p-6">
          <div className="flex max-w-2xl flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const loadedRouting = settingsData?.notification_routing as RoutingMatrix | undefined
  const loadedQuietHours = settingsData?.quiet_hours as QuietHours | undefined

  return (
    <NotificationSettingsForm
      initialRouting={loadedRouting ?? DEFAULT_ROUTING}
      initialQuietHours={loadedQuietHours ?? DEFAULT_QUIET_HOURS}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root })
      }}
    />
  )
}

function NotificationSettingsForm({
  initialRouting,
  initialQuietHours,
  onSaved,
}: {
  initialRouting: RoutingMatrix
  initialQuietHours: QuietHours
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [routing, setRouting] = useState<RoutingMatrix>(initialRouting)
  const [quietHours, setQuietHours] = useState<QuietHours>(initialQuietHours)

  // Check push status on mount
  useEffect(() => {
    void isPushSubscribed().then(setPushEnabled)
  }, [])

  const handleTogglePush = useCallback(async () => {
    if (pushEnabled) {
      const ok = await unregisterPush()
      if (ok) {
        setPushEnabled(false)
        toast.success(t("notifications.push_disabled"))
      }
    } else {
      const ok = await registerPush()
      if (ok) {
        setPushEnabled(true)
        toast.success(t("notifications.push_enabled"))
      } else {
        toast.error(t("notifications.push_denied"))
      }
    }
  }, [pushEnabled, t])

  const handleToggleRouting = useCallback((type: string, transport: string) => {
    setRouting((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [transport]: !prev[type]?.[transport],
      },
    }))
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.settings.$patch({
        json: {
          notification_routing: routing,
          quiet_hours: quietHours,
        },
      })
      if (!res.ok) throw new Error("Failed to save notification settings")
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      onSaved()
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("notifications.settings_title")}
        description={t("notifications.settings_description")}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          {/* Push Status */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <BellIcon size={16} className="text-muted-foreground" />
              <h2 className="font-heading text-sm font-semibold">
                {t("notifications.push_title")}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${pushEnabled ? "bg-green-500" : "bg-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">
                {pushEnabled ? t("notifications.push_status_enabled") : t("notifications.push_status_disabled")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTogglePush()}
              >
                {pushEnabled ? t("notifications.push_disable") : t("notifications.push_enable")}
              </Button>
            </div>
          </section>

          {/* Routing Matrix */}
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-semibold">
              {t("notifications.what_to_notify")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-heading font-medium text-muted-foreground" />
                    {TRANSPORTS.map((tr) => (
                      <th key={tr.key} className="px-4 py-2 text-center font-heading font-medium text-muted-foreground">
                        {t(tr.labelKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_TYPES.map((type) => (
                    <tr key={type.key} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-heading text-foreground">
                        {t(type.labelKey)}
                      </td>
                      {TRANSPORTS.map((tr) => (
                        <td key={tr.key} className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!routing[type.key]?.[tr.key]}
                            onChange={() => handleToggleRouting(type.key, tr.key)}
                            className="h-4 w-4 accent-primary"
                            aria-label={`${t(type.labelKey)} ${t(tr.labelKey)}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Quiet Hours */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MoonIcon size={16} className="text-muted-foreground" />
              <h2 className="font-heading text-sm font-semibold">
                {t("notifications.quiet_hours_title")}
              </h2>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={quietHours.enabled}
                onChange={(e) => setQuietHours((qh) => ({ ...qh, enabled: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <span>{t("notifications.quiet_hours_enable")}</span>
            </label>

            {quietHours.enabled && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-muted-foreground">{t("notifications.quiet_hours_from")}</label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours((qh) => ({ ...qh, start: e.target.value }))}
                    className="h-7 border border-border bg-background px-2 text-xs"
                  />
                  <label className="text-muted-foreground">{t("notifications.quiet_hours_to")}</label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours((qh) => ({ ...qh, end: e.target.value }))}
                    className="h-7 border border-border bg-background px-2 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-muted-foreground">{t("notifications.quiet_hours_timezone")}</label>
                  <input
                    type="text"
                    value={quietHours.timezone}
                    onChange={(e) => setQuietHours((qh) => ({ ...qh, timezone: e.target.value }))}
                    className="h-7 w-48 border border-border bg-background px-2 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={quietHours.except.includes("urgent")}
                    onChange={(e) =>
                      setQuietHours((qh) => ({
                        ...qh,
                        except: e.target.checked
                          ? [...qh.except, "urgent"]
                          : qh.except.filter((ex) => ex !== "urgent"),
                      }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{t("notifications.quiet_hours_except_urgent")}</span>
                </label>
              </div>
            )}
          </section>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("common.saving") : t("settings.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
