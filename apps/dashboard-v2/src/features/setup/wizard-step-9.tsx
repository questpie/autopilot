import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeftIcon, WarningCircleIcon, GitBranchIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

const projectSchema = z.object({
  gitUrl: z.string().min(1, "Git URL is required"),
  branch: z.string().min(1),
})

type ProjectValues = z.infer<typeof projectSchema>

interface WizardStep9Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep9({ onComplete, onBack, onSkip }: WizardStep9Props) {
  const { t } = useTranslation()
  const { completeStep, skipStep } = useWizardState()
  const [error, setError] = useState<string | null>(null)
  const [connectedRepos, setConnectedRepos] = useState<string[]>([])

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { gitUrl: "", branch: "main" },
  })

  const onSubmit = async (values: ProjectValues) => {
    setError(null)

    try {
      const res = await api.api.settings.$patch({
        json: {
          git_clone: { url: values.gitUrl, branch: values.branch },
        },
      })

      if (!res.ok) throw new Error("Failed to clone repository")

      setConnectedRepos((prev) => [...prev, values.gitUrl])
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone")
    }
  }

  const handleFinish = () => {
    completeStep(9)
    onComplete()
  }

  const handleSkip = () => {
    skipStep(9)
    onSkip()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("setup.step_9_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_9_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connected repos */}
      {connectedRepos.length > 0 && (
        <div className="flex flex-col gap-1">
          {connectedRepos.map((repo, i) => (
            <div
              key={`${repo}-${i}`}
              className="flex items-center gap-2 border border-green-500/30 bg-green-500/5 px-3 py-2"
            >
              <GitBranchIcon className="size-3.5 text-green-500" />
              <span className="font-heading text-xs">{repo}</span>
            </div>
          ))}
        </div>
      )}

      {/* Git clone form */}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="git-url" className="font-heading text-xs font-medium">
              {t("setup.step_9_git_url")}
            </Label>
            <Input
              id="git-url"
              placeholder="git@github.com:org/repo.git"
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.gitUrl}
              {...form.register("gitUrl")}
            />
            {form.formState.errors.gitUrl && (
              <p className="text-xs text-destructive">{form.formState.errors.gitUrl.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch" className="font-heading text-xs font-medium">
              {t("setup.step_9_branch")}
            </Label>
            <Input
              id="branch"
              placeholder="main"
              disabled={form.formState.isSubmitting}
              {...form.register("branch")}
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            size="default"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <Spinner size="sm" />
            ) : (
              <GitBranchIcon className="size-3.5" />
            )}
            {t("setup.step_9_clone")}
          </Button>
        </form>
      </FormProvider>

      {/* CLI hint */}
      <p className="text-xs text-muted-foreground/60">
        {t("setup.cli_hint")}: autopilot project add [url]
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          {t("common.back")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={handleSkip}>
          {t("common.skip")}
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={handleFinish}>
          {t("common.finish")}
        </Button>
      </div>
    </div>
  )
}
