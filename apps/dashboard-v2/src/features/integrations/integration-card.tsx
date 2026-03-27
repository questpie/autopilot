import {
  GithubLogoIcon,
  SlackLogoIcon,
  TelegramLogoIcon,
  GoogleLogoIcon,
  FigmaLogoIcon,
  PlugsIcon,
  CheckCircleIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface IntegrationInfo {
  id: string
  name: string
  description: string
  icon: Icon
  category: "code" | "communication" | "design" | "productivity"
  connected: boolean
  secretRef?: string
  agents?: string[]
  connectedAt?: string
}

export const AVAILABLE_INTEGRATIONS: IntegrationInfo[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Code hosting, PRs, issues, and CI/CD",
    icon: GithubLogoIcon,
    category: "code",
    connected: false,
  },
  {
    id: "linear",
    name: "Linear",
    description: "Project management and issue tracking",
    icon: PlugsIcon,
    category: "productivity",
    connected: false,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Email sending and monitoring",
    icon: GoogleLogoIcon,
    category: "communication",
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team messaging and notifications",
    icon: SlackLogoIcon,
    category: "communication",
    connected: false,
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot messaging and notifications",
    icon: TelegramLogoIcon,
    category: "communication",
    connected: false,
  },
  {
    id: "figma",
    name: "Figma",
    description: "Design files and prototypes",
    icon: FigmaLogoIcon,
    category: "design",
    connected: false,
  },
]

interface IntegrationCardProps {
  integration: IntegrationInfo
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onTest: (id: string) => void
}

export function IntegrationCard({ integration, onConnect, onDisconnect, onTest }: IntegrationCardProps) {
  const { t } = useTranslation()
  const IconComponent = integration.icon

  return (
    <div className="flex flex-col gap-3 border border-border p-4 transition-colors hover:bg-muted/30">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center bg-muted">
            <IconComponent size={20} weight="bold" className="text-foreground" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-sm font-bold text-foreground">
              {integration.name}
            </span>
            <span className="font-sans text-xs text-muted-foreground">
              {integration.description}
            </span>
          </div>
        </div>
        {integration.connected ? (
          <Badge variant="outline" className="gap-1 rounded-none text-[9px] text-green-500">
            <CheckCircleIcon size={10} weight="fill" />
            {t("integrations.connected")}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 rounded-none text-[9px] text-muted-foreground">
            <XCircleIcon size={10} />
            {t("integrations.not_connected")}
          </Badge>
        )}
      </div>

      {/* Connected details */}
      {integration.connected && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {integration.secretRef && (
            <div className="flex items-center gap-2">
              <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("integrations.secret_ref")}
              </span>
              <span className="font-mono text-[10px] text-foreground">
                {integration.secretRef}
              </span>
            </div>
          )}
          {integration.agents && integration.agents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("integrations.allowed_agents")}
              </span>
              <div className="flex flex-wrap gap-1">
                {integration.agents.map((agent) => (
                  <Badge key={agent} variant="secondary" className="rounded-none text-[9px]">
                    {agent}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {integration.connected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none font-heading text-[10px]"
              onClick={() => onTest(integration.id)}
            >
              {t("integrations.test_connection")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none font-heading text-[10px] text-destructive hover:text-destructive"
              onClick={() => onDisconnect(integration.id)}
            >
              {t("integrations.disconnect")}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-none font-heading text-[10px]"
            onClick={() => onConnect(integration.id)}
          >
            {t("integrations.connect")}
          </Button>
        )}
      </div>
    </div>
  )
}
