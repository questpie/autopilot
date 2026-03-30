import { useTranslation } from "@/lib/i18n"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircleIcon, ArrowRightIcon } from "@phosphor-icons/react"
import { useWizardState } from "./use-wizard-state"

interface WizardDoneProps {
  onFinish: () => void
}

export function WizardDone({ onFinish }: WizardDoneProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accountData, providerChoice, teamTemplate, isStepComplete, isStepSkipped, reset } =
    useWizardState()

  const handleOpenDashboard = () => {
    reset()
    onFinish()
    void navigate({ to: "/" })
  }

  const summaryItems = [
    {
      label: "Owner",
      value: accountData
        ? `${accountData.name} (${accountData.email})`
        : "Configured",
    },
    {
      label: "2FA",
      value: isStepComplete(2) ? "Enabled" : "Skipped",
    },
    {
      label: "Provider",
      value: providerChoice
        ? "OpenRouter"
        : "Not configured",
    },
    {
      label: "Company",
      value: isStepComplete(4) && !isStepSkipped(4) ? "Configured" : "Skipped",
    },
    {
      label: "Team",
      value: teamTemplate
        ? teamTemplate === "solo"
          ? "Solo Dev Shop (8 agents)"
          : teamTemplate === "minimal"
            ? "Minimal (3 agents)"
            : "Custom"
        : "Skipped",
    },
    {
      label: "Knowledge",
      value: isStepComplete(6) && !isStepSkipped(6) ? "Uploaded" : "Skipped",
    },
    {
      label: "Integrations",
      value: isStepComplete(7) && !isStepSkipped(7) ? "Connected" : "Skipped",
    },
    {
      label: "Workflows",
      value: isStepComplete(8) && !isStepSkipped(8) ? "Configured" : "Skipped",
    },
    {
      label: "Projects",
      value: isStepComplete(9) && !isStepSkipped(9) ? "Connected" : "Skipped",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircleIcon className="size-10 text-success" weight="fill" />
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.done_title")}
        </h2>
      </div>

      {/* Summary */}
      <div className="flex flex-col gap-1 border border-border p-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex justify-between py-0.5">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className="font-heading text-xs font-medium">{item.value}</span>
          </div>
        ))}
      </div>

      {/* First intent input */}
      <div className="flex flex-col gap-2">
        <Input
          placeholder={t("setup.done_ask")}
          className="text-sm"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground/60">
            {t("setup.done_example_1")}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {t("setup.done_example_2")}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {t("setup.done_example_3")}
          </span>
        </div>
      </div>

      <Button type="button" size="lg" className="w-full" onClick={handleOpenDashboard}>
        {t("setup.done_open_dashboard")}
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  )
}
