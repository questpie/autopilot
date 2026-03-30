import { createFileRoute } from "@tanstack/react-router"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FloppyDiskIcon, DesktopIcon, SignOutIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FormField, FormSection, FormActions } from "@/components/forms"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface SessionInfo {
  id: string
  token: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
}

export const Route = createFileRoute("/_app/settings/profile")({
  component: SettingsProfilePage,
})

function SettingsProfilePage() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.profile")}
        description={t("settings.profile_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex max-w-lg flex-col gap-8">
          {session?.user ? (
            <ProfileForm user={session.user} />
          ) : (
            <ProfileSkeleton />
          )}
          <SessionsList />
        </div>
      </div>
    </div>
  )
}

function ProfileForm({ user }: { user: { name: string; email: string } }) {
  const { t } = useTranslation()

  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name ?? "",
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const res = await authClient.updateUser({
        name: values.name,
      })
      if (res.error) throw new Error(res.error.message ?? t("errors.failed_update_profile"))
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
    },
    onError: (err) => {
      toast.error((err as Error).message)
    },
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit((v) => updateMutation.mutate(v))}
        className="flex flex-col gap-6"
      >
        <FormSection title={t("settings.profile")}>
          <FormField name="name" label={t("settings.display_name")} />
          <div className="flex flex-col gap-1.5">
            <label className="font-heading text-xs font-medium text-foreground">
              {t("settings.user_email")}
            </label>
            <p className="flex h-9 items-center border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </FormSection>

        <FormActions>
          <Button
            type="submit"
            size="sm"
            disabled={updateMutation.isPending || !methods.formState.isDirty}
            className="gap-1.5"
          >
            <FloppyDiskIcon size={14} />
            {t("settings.save")}
          </Button>
        </FormActions>
      </form>
    </FormProvider>
  )
}

function SessionsList() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: sessions } = useSuspenseQuery({
    queryKey: queryKeys.userSessions.list(),
    queryFn: async () => {
      const res = await authClient.listSessions()
      if (res.error) return []
      return res.data as unknown as SessionInfo[]
    },
    staleTime: 30_000,
  })

  const revokeMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      const res = await authClient.revokeSession({ token: sessionToken })
      if (res.error) throw new Error(res.error.message ?? "Failed to revoke session")
    },
    onSuccess: () => {
      toast.success(t("settings.session_revoked"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSessions.root })
    },
    onError: (err) => {
      toast.error((err as Error).message)
    },
  })

  return (
    <FormSection title={t("settings.active_sessions")}>
      {sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <DesktopIcon size={16} className="shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-heading text-xs">
                    {session.userAgent?.split(" ")[0] ?? t("errors.unknown_device")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {session.ipAddress ?? t("errors.unknown_ip")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => revokeMutation.mutate(session.token)}
                disabled={revokeMutation.isPending}
              >
                <SignOutIcon size={12} />
                {t("settings.revoke_session")}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("common.empty")}
        </p>
      )}
    </FormSection>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}
