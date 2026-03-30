import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeftIcon,
  WarningCircleIcon,
  GithubLogoIcon,
  EnvelopeSimpleIcon,
  ChatCircleIcon,
  TelegramLogoIcon,
  FigmaLogoIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  enabled: boolean
  tokenValue: string
  tokenPlaceholder: string
  connectLabel: string
}

interface WizardStep7Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep7({ onComplete, onBack, onSkip }: WizardStep7Props) {
  const { t } = useTranslation()
  const { completeStep, skipStep } = useWizardState()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mcpUrl, setMcpUrl] = useState("")

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "github",
      name: "GitHub",
      description: "Code repos, PRs, issues",
      icon: <GithubLogoIcon className="size-5" />,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "ghp_...",
      connectLabel: "Connect with token",
    },
    {
      id: "linear",
      name: "Linear",
      description: "Issue tracking",
      icon: <div className="flex size-5 items-center justify-center font-heading text-xs font-bold">L</div>,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "lin_api_...",
      connectLabel: "Add API key",
    },
    {
      id: "gmail",
      name: "Gmail",
      description: "Email access",
      icon: <EnvelopeSimpleIcon className="size-5" />,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "OAuth token",
      connectLabel: "Connect with OAuth",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Team messaging",
      icon: <ChatCircleIcon className="size-5" />,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "https://hooks.slack.com/...",
      connectLabel: "Add webhook URL",
    },
    {
      id: "telegram",
      name: "Telegram",
      description: "Notifications & commands",
      icon: <TelegramLogoIcon className="size-5" />,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "bot_token",
      connectLabel: "Add bot token",
    },
    {
      id: "figma",
      name: "Figma",
      description: "Design files",
      icon: <FigmaLogoIcon className="size-5" />,
      enabled: false,
      tokenValue: "",
      tokenPlaceholder: "figd_...",
      connectLabel: "Add access token",
    },
  ])

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id ? { ...int, enabled: !int.enabled } : int
      )
    )
  }

  const setTokenValue = (id: string, value: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id ? { ...int, tokenValue: value } : int
      )
    )
  }

  const handleContinue = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const enabled = integrations.filter((i) => i.enabled && i.tokenValue)
      if (enabled.length > 0) {
        const secrets: Record<string, string> = {}
        for (const int of enabled) {
          secrets[`${int.id.toUpperCase()}_TOKEN`] = int.tokenValue
        }

        const res = await api.api.settings.$patch({
          json: { integrations: secrets },
        })

        if (!res.ok) throw new Error("Failed to save integrations")
      }

      completeStep(7)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    skipStep(7)
    onSkip()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.step_7_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_7_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Popular integrations */}
      <div className="flex flex-col gap-1.5">
        <Label className="font-heading text-xs font-semibold uppercase">
          {t("setup.step_7_popular")}
        </Label>

        <div className="flex flex-col gap-2">
          {integrations.map((int) => (
            <div
              key={int.id}
              className="flex flex-col gap-2 border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={int.enabled}
                  onCheckedChange={() => toggleIntegration(int.id)}
                  id={`int-${int.id}`}
                />
                <div className="text-muted-foreground">{int.icon}</div>
                <div className="flex-1">
                  <label htmlFor={`int-${int.id}`} className="font-heading text-xs font-medium">
                    {int.name}
                  </label>
                  <p className="text-xs text-muted-foreground">{int.description}</p>
                </div>
              </div>

              {int.enabled && (
                <Input
                  type="password"
                  placeholder={int.tokenPlaceholder}
                  value={int.tokenValue}
                  onChange={(e) => setTokenValue(int.id, e.currentTarget.value)}
                  className="ml-7"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MCP servers */}
      <div className="flex flex-col gap-1.5">
        <Label className="font-heading text-xs font-semibold uppercase">
          {t("setup.step_7_mcp")}
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder={t("setup.step_7_mcp_desc")}
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.currentTarget.value)}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="default" disabled={!mcpUrl.trim()}>
            <PlusIcon className="size-3.5" />
            {t("setup.step_7_add_mcp")}
          </Button>
        </div>
      </div>

      {/* AI chat placeholder */}
      <div className="border border-dashed border-primary/20 p-3">
        <Input
          placeholder={t("setup.ai_placeholder")}
          disabled
          className="border-0 bg-transparent text-xs"
        />
      </div>

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
