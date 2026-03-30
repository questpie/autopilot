import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  CheckCircleIcon,
  CircleNotchIcon,
  ArrowRightIcon,
  KeyIcon,
  FileIcon,
  RobotIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCreateFile } from "@/features/files/files.mutations"
import type { IntegrationInfo } from "./integration-card"

const connectSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  agents: z.string().optional(),
})

type ConnectFormValues = z.infer<typeof connectSchema>

interface ConnectWizardProps {
  integration: IntegrationInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: (id: string) => void
}

const STEP_ICONS = [KeyIcon, FileIcon, RobotIcon, CheckCircleIcon] as const

export function ConnectWizard({ integration, open, onOpenChange, onConnected }: ConnectWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [testing, setTesting] = useState(false)
  const createFile = useCreateFile()

  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: { apiKey: "", agents: "ceo" },
  })

  const stepLabels = [
    t("integrations.setup_step_credentials"),
    t("integrations.setup_step_secret"),
    t("integrations.setup_step_knowledge"),
    t("integrations.setup_step_agents"),
  ]

  const handleNext = useCallback(async () => {
    if (!integration) return

    if (step === 0) {
      // Validate API key
      const valid = await form.trigger("apiKey")
      if (!valid) return
      setStep(1)
    } else if (step === 1) {
      // Create secret file
      const values = form.getValues()
      const agentList = (values.agents ?? "ceo")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)

      const secretContent = [
        `service: ${integration.id}`,
        `type: api_key`,
        `value: "${values.apiKey}"`,
        `allowed_agents: [${agentList.join(", ")}]`,
        `usage: |`,
        `  Authorization: Bearer {value}`,
      ].join("\n")

      createFile.mutate(
        { path: `secrets/${integration.id}.yaml`, content: secretContent },
        {
          onSuccess: () => setStep(2),
          onError: (err) => toast.error(err.message),
        },
      )
    } else if (step === 2) {
      // Create knowledge doc
      const knowledgeContent = [
        `---`,
        `title: ${integration.name} Integration`,
        `created: ${new Date().toISOString().split("T")[0]}`,
        `---`,
        ``,
        `# ${integration.name} Integration`,
        ``,
        `## Authentication`,
        ``,
        `Use secret_ref: "${integration.id}" for API calls.`,
        ``,
        `## Common API Endpoints`,
        ``,
        `(Document your commonly used endpoints here)`,
        ``,
        `## Conventions`,
        ``,
        `(Document your team's conventions for this integration)`,
      ].join("\n")

      createFile.mutate(
        { path: `knowledge/integrations/${integration.id}.md`, content: knowledgeContent },
        {
          onSuccess: () => setStep(3),
          onError: (err) => toast.error(err.message),
        },
      )
    } else if (step === 3) {
      // Done
      toast.success(t("integrations.connected_success", { name: integration.name }))
      onConnected(integration.id)
      handleClose()
    }
  }, [step, integration, form, createFile, onConnected, t])

  const handleClose = useCallback(() => {
    setStep(0)
    form.reset()
    onOpenChange(false)
  }, [form, onOpenChange])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    // Simulate a connection test
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1500)
    })
    setTesting(false)
    toast.success(t("integrations.test_success"))
  }, [t])

  if (!integration) return null

  const IntegrationIcon = integration.icon

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm">
            <IntegrationIcon size={18} weight="bold" />
            {t("integrations.connect")} {integration.name}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => {
            const StepIcon = STEP_ICONS[i]
            const isActive = i === step
            const isDone = i < step
            return (
              <div
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={`flex size-6 items-center justify-center ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "border border-primary bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircleIcon size={14} weight="fill" />
                  ) : (
                    <StepIcon size={12} />
                  )}
                </div>
                <span
                  className={`text-center font-heading text-[8px] uppercase tracking-widest ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[120px] py-2">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("integrations.api_key")}
              </label>
              <Input
                type="password"
                {...form.register("apiKey")}
                placeholder={t("integrations.api_key_placeholder")}
                className="rounded-none font-mono text-xs"
                autoFocus
              />
              {form.formState.errors.apiKey && (
                <span className="font-heading text-[10px] text-destructive">
                  {form.formState.errors.apiKey.message}
                </span>
              )}
              <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("integrations.allowed_agents")}
              </label>
              <Input
                {...form.register("agents")}
                placeholder="ceo, max, ops"
                className="rounded-none font-heading text-xs"
              />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col items-center gap-3 py-4">
              {createFile.isPending ? (
                <CircleNotchIcon size={24} className="animate-spin text-primary" />
              ) : (
                <CheckCircleIcon size={24} weight="fill" className="text-primary" />
              )}
              <span className="font-heading text-xs text-foreground">
                {t("integrations.setup_step_secret")}
              </span>
              <Badge variant="outline" className="rounded-none font-mono text-[9px]">
                secrets/{integration.id}.yaml
              </Badge>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-3 py-4">
              {createFile.isPending ? (
                <CircleNotchIcon size={24} className="animate-spin text-primary" />
              ) : (
                <CheckCircleIcon size={24} weight="fill" className="text-primary" />
              )}
              <span className="font-heading text-xs text-foreground">
                {t("integrations.setup_step_knowledge")}
              </span>
              <Badge variant="outline" className="rounded-none font-mono text-[9px]">
                knowledge/integrations/{integration.id}.md
              </Badge>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircleIcon size={32} weight="fill" className="text-success" />
              <span className="font-heading text-sm font-bold text-foreground">
                {integration.name} {t("integrations.connected").toLowerCase()}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-none font-heading text-[10px]"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <SpinnerIcon size={12} className="animate-spin" />
                ) : null}
                {t("integrations.test_connection")}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none"
            onClick={handleClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            className="gap-1 rounded-none"
            onClick={handleNext}
            disabled={createFile.isPending}
          >
            {step < 3 ? (
              <>
                {t("common.next")}
                <ArrowRightIcon size={12} />
              </>
            ) : (
              t("common.finish")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
