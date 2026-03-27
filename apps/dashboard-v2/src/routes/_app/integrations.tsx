import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  PlugsIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  PlugIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  IntegrationCard,
  AVAILABLE_INTEGRATIONS,
  type IntegrationInfo,
} from "@/features/integrations/integration-card"
import { ConnectWizard } from "@/features/integrations/connect-wizard"

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
})

interface McpServer {
  id: string
  url: string
  addedAt: string
}

const mcpSchema = z.object({
  url: z.string().min(1, "URL or package name is required"),
})

type McpFormValues = z.infer<typeof mcpSchema>

function IntegrationsPage() {
  const { t } = useTranslation()
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>(AVAILABLE_INTEGRATIONS)
  const [connectTarget, setConnectTarget] = useState<IntegrationInfo | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null)
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const mcpForm = useForm<McpFormValues>({
    resolver: zodResolver(mcpSchema),
    defaultValues: { url: "" },
  })

  const connectedIntegrations = integrations.filter((i) => i.connected)
  const availableIntegrations = integrations.filter((i) => !i.connected)

  const handleConnect = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id)
      if (!integration) return
      setConnectTarget(integration)
      setConnectOpen(true)
    },
    [integrations],
  )

  const handleConnected = useCallback((id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              connected: true,
              secretRef: `secrets/${id}.yaml`,
              agents: ["ceo"],
              connectedAt: new Date().toISOString(),
            }
          : i,
      ),
    )
  }, [])

  const handleDisconnect = useCallback((id: string) => {
    setDisconnectTarget(id)
  }, [])

  const confirmDisconnect = useCallback(() => {
    if (!disconnectTarget) return
    const name = integrations.find((i) => i.id === disconnectTarget)?.name ?? disconnectTarget
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === disconnectTarget
          ? { ...i, connected: false, secretRef: undefined, agents: undefined, connectedAt: undefined }
          : i,
      ),
    )
    toast.success(t("integrations.disconnected", { name }))
    setDisconnectTarget(null)
  }, [disconnectTarget, integrations, t])

  const handleTest = useCallback(
    async (id: string) => {
      setTestingId(id)
      // Simulate test
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1500)
      })
      setTestingId(null)
      toast.success(t("integrations.test_success"))
    },
    [t],
  )

  const handleAddMcp = useCallback(
    (values: McpFormValues) => {
      const server: McpServer = {
        id: crypto.randomUUID(),
        url: values.url,
        addedAt: new Date().toISOString(),
      }
      setMcpServers((prev) => [...prev, server])
      toast.success(t("integrations.mcp_added"))
      mcpForm.reset()
      setMcpDialogOpen(false)
    },
    [t, mcpForm],
  )

  const handleRemoveMcp = useCallback(
    (id: string) => {
      setMcpServers((prev) => prev.filter((s) => s.id !== id))
      toast.success(t("integrations.mcp_removed"))
    },
    [t],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-bold text-foreground">
            {t("integrations.title")}
          </h1>
          <p className="font-sans text-xs text-muted-foreground">
            {t("integrations.description")}
          </p>
        </div>
      </div>

      {/* Connected integrations */}
      {connectedIntegrations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <PlugsIcon size={14} weight="bold" className="text-green-500" />
            <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-foreground">
              {t("integrations.connected")}
            </h2>
            <Badge variant="outline" className="rounded-none text-[9px]">
              {connectedIntegrations.length}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {connectedIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={
                  testingId === integration.id
                    ? { ...integration }
                    : integration
                }
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onTest={handleTest}
              />
            ))}
          </div>
        </section>
      )}

      {connectedIntegrations.length > 0 && availableIntegrations.length > 0 && (
        <Separator />
      )}

      {/* Available integrations */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon size={14} className="text-muted-foreground" />
          <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-foreground">
            {t("integrations.available")}
          </h2>
        </div>
        {availableIntegrations.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onTest={handleTest}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <PlugsIcon size={24} />
            <span className="font-heading text-xs">
              {t("integrations.no_integrations")}
            </span>
          </div>
        )}
      </section>

      <Separator />

      {/* MCP Servers */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlugIcon size={14} className="text-muted-foreground" />
            <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-foreground">
              {t("integrations.mcp_servers")}
            </h2>
            {mcpServers.length > 0 && (
              <Badge variant="outline" className="rounded-none text-[9px]">
                {mcpServers.length}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 rounded-none font-heading text-[10px]"
            onClick={() => setMcpDialogOpen(true)}
          >
            <PlusIcon size={12} />
            {t("integrations.mcp_add")}
          </Button>
        </div>

        {mcpServers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-foreground">{server.url}</span>
                  <span className="font-heading text-[9px] text-muted-foreground">
                    {t("integrations.connected_at")}:{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(server.addedAt))}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-destructive hover:text-destructive"
                  onClick={() => handleRemoveMcp(server.id)}
                >
                  <TrashIcon size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border border-dashed border-border py-8 text-center text-muted-foreground">
            <PlugIcon size={20} />
            <span className="font-heading text-xs">
              {t("integrations.mcp_no_servers")}
            </span>
            <span className="font-sans text-[10px]">
              {t("integrations.mcp_no_servers_description")}
            </span>
          </div>
        )}
      </section>

      {/* Connect wizard */}
      <ConnectWizard
        integration={connectTarget}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={handleConnected}
      />

      {/* Disconnect confirmation */}
      <Dialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-sm">
              <WarningIcon size={16} className="text-destructive" />
              {t("integrations.disconnect")}
            </DialogTitle>
          </DialogHeader>
          <p className="font-sans text-xs text-muted-foreground">
            {t("integrations.disconnect_confirm", {
              name: integrations.find((i) => i.id === disconnectTarget)?.name ?? "",
            })}
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none"
              onClick={() => setDisconnectTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-none"
              onClick={confirmDisconnect}
            >
              {t("integrations.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MCP add dialog */}
      <Dialog open={mcpDialogOpen} onOpenChange={setMcpDialogOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("integrations.mcp_add")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={mcpForm.handleSubmit(handleAddMcp)} className="flex flex-col gap-3">
            <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("integrations.mcp_url")}
            </label>
            <Input
              {...mcpForm.register("url")}
              placeholder={t("integrations.mcp_url_placeholder")}
              className="rounded-none font-mono text-xs"
              autoFocus
            />
            {mcpForm.formState.errors.url && (
              <span className="font-heading text-[10px] text-destructive">
                {mcpForm.formState.errors.url.message}
              </span>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-none"
                onClick={() => setMcpDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" className="rounded-none">
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
