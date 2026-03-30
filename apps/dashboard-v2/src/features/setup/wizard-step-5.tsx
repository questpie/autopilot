import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

type TeamTemplate = "solo" | "minimal" | "custom"

interface WizardStep5Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep5({ onComplete, onBack, onSkip }: WizardStep5Props) {
  const { t } = useTranslation()
  const { setTeamTemplate, completeStep, skipStep } = useWizardState()
  const [selected, setSelected] = useState<TeamTemplate>("solo")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleContinue = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await api.api.settings.$patch({
        json: { team_template: selected },
      })

      if (!res.ok) throw new Error("Failed to apply team template")

      setTeamTemplate(selected)
      completeStep(5)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    skipStep(5)
    onSkip()
  }

  const templates: Array<{
    id: TeamTemplate
    label: string
    description: string
    recommended?: boolean
  }> = [
    {
      id: "solo",
      label: t("setup.step_5_solo"),
      description: t("setup.step_5_solo_desc"),
      recommended: true,
    },
    {
      id: "minimal",
      label: t("setup.step_5_minimal"),
      description: t("setup.step_5_minimal_desc"),
    },
    {
      id: "custom",
      label: t("setup.step_5_custom"),
      description: t("setup.step_5_custom_desc"),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.step_5_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_5_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setSelected(tpl.id)}
            className={`flex items-start gap-3 border p-3 text-left transition-colors ${
              selected === tpl.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div
              className={`mt-0.5 flex size-4 items-center justify-center border ${
                selected === tpl.id ? "border-primary" : "border-input"
              }`}
            >
              {selected === tpl.id && <div className="size-2 bg-primary" />}
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs font-medium">{tpl.label}</span>
                {tpl.recommended && (
                  <span className="text-xs text-primary">recommended</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{tpl.description}</span>
            </div>
          </button>
        ))}
      </div>

      {/* AI chat placeholder */}
      <div className="border border-dashed border-primary/20 p-3">
        <Input
          placeholder={t("setup.ai_placeholder")}
          disabled
          className="border-0 bg-transparent text-xs"
        />
      </div>

      {/* CLI hint */}
      <p className="text-xs text-muted-foreground/60">
        {t("setup.cli_hint")}: autopilot team template {selected}
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
