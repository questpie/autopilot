import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

interface Workflow {
  id: string
  name: string
  stepCount: number
  description: string
  enabled: boolean
}

interface WizardStep8Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep8({ onComplete, onBack, onSkip }: WizardStep8Props) {
  const { t } = useTranslation()
  const { completeStep, skipStep } = useWizardState()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: "development",
      name: "Development",
      stepCount: 12,
      description: "scope > plan > implement > review > human_merge > deploy > verify > done",
      enabled: true,
    },
    {
      id: "marketing",
      name: "Marketing",
      stepCount: 7,
      description: "brief > create > human_approve > publish > monitor > done",
      enabled: true,
    },
    {
      id: "incident",
      name: "Incident Response",
      stepCount: 8,
      description: "detect > investigate > fix > verify > postmortem > done",
      enabled: true,
    },
  ])

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === id ? { ...wf, enabled: !wf.enabled } : wf
      )
    )
  }

  const handleContinue = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const enabled = workflows.filter((w) => w.enabled).map((w) => w.id)

      const res = await api.api.settings.$patch({
        json: { workflows: enabled },
      })

      if (!res.ok) throw new Error("Failed to save workflows")

      completeStep(8)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    skipStep(8)
    onSkip()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.step_8_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_8_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Included workflows */}
      <div className="flex flex-col gap-1.5">
        <Label className="font-heading text-xs font-semibold uppercase">
          {t("setup.step_8_included")}
        </Label>

        <div className="flex flex-col gap-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="flex items-start gap-3 border border-border p-3"
            >
              <Checkbox
                checked={wf.enabled}
                onCheckedChange={() => toggleWorkflow(wf.id)}
                id={`wf-${wf.id}`}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <label htmlFor={`wf-${wf.id}`} className="font-heading text-xs font-medium">
                  {wf.name} ({wf.stepCount} steps)
                </label>
                <span className="font-heading text-xs text-muted-foreground">
                  {wf.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom workflow AI input */}
      <div className="flex flex-col gap-1.5">
        <Label className="font-heading text-xs font-semibold uppercase">
          {t("setup.step_8_custom")}
        </Label>
        <div className="border border-dashed border-primary/20 p-3">
          <Input
            placeholder={t("setup.ai_placeholder")}
            disabled
            className="border-0 bg-transparent text-xs"
          />
        </div>
      </div>

      {/* CLI hint */}
      <p className="text-xs text-muted-foreground/60">
        {t("setup.cli_hint")}: autopilot workflow list
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          {t("common.back")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={handleSkip}>
          {t("common.skip")}
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          disabled={isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? <Spinner size="sm" /> : t("common.continue")}
        </Button>
      </div>
    </div>
  )
}
