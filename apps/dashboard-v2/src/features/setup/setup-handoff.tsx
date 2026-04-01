import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import type { WizardAccountData } from "./use-wizard-state"
import { useWizardState } from "./use-wizard-state"

interface SummaryItem {
  label: string
  value: string
}

interface SetupHandoffProps {
  fallbackOwner?: WizardAccountData | null
}

export function SetupHandoff({ fallbackOwner = null }: SetupHandoffProps): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accountData, providerChoice, isStepComplete, reset } = useWizardState()
  const owner = fallbackOwner ?? accountData

  const completeSetup = useMutation({
    mutationFn: async () => {
      const res = await api.api.setup.complete.$post()
      if (!res.ok) {
        throw new Error("Failed to complete setup")
      }
    },
    onError: () => toast.error("Failed to finalize setup."),
  })

  const summaryItems: SummaryItem[] = [
    {
      label: t("setup.done_summary_owner"),
      value: owner ? `${owner.name} (${owner.email})` : t("setup.done_ready"),
    },
    {
      label: t("setup.done_summary_security"),
      value: isStepComplete(2) ? t("setup.done_security_enabled") : t("setup.done_ready"),
    },
    {
      label: t("setup.done_summary_provider"),
      value: providerChoice ? t("setup.done_provider_connected") : t("setup.done_ready"),
    },
  ]

  const nextSteps = [
    t("setup.done_next_shell"),
    t("setup.done_next_channels"),
    t("setup.done_next_ceo"),
  ]

  async function handleOpenWorkspace(): Promise<void> {
    try {
      await completeSetup.mutateAsync()
      reset()
      await navigate({ to: "/" })
    } catch {
      // Mutation onError already surfaces the failure toast.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircleIcon className="size-10 text-success" weight="fill" />
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold">{t("setup.done_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("setup.done_description")}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3 border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            {t("setup.done_summary_title")}
          </h3>
          <span className="text-[10px] text-success">{t("setup.done_ready")}</span>
        </div>

        <div className="flex flex-col gap-1">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex justify-between gap-3 py-0.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-right font-heading text-xs font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-border p-4">
        <div className="space-y-1">
          <h3 className="font-heading text-sm font-medium">{t("setup.done_handoff_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("setup.done_handoff_description")}</p>
        </div>

        <div className="flex flex-col gap-2">
          {nextSteps.map((step, index) => (
            <div key={step} className="flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center border border-border font-heading text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm text-foreground">{step}</span>
            </div>
          ))}
        </div>
      </section>

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => void handleOpenWorkspace()}
        loading={completeSetup.isPending}
      >
        {t("setup.done_open_workspace")}
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  )
}
