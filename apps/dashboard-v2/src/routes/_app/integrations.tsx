import { useReducer, useCallback } from "react"
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

// --- Reducer ---

interface IntegrationsState {
  integrations: IntegrationInfo[]
  connectTarget: IntegrationInfo | null
  connectOpen: boolean
  disconnectTarget: string | null
  mcpServers: McpServer[]
  mcpDialogOpen: boolean
  testingId: string | null
}

type IntegrationsAction =
  | { type: "OPEN_CONNECT"; target: IntegrationInfo }
  | { type: "CLOSE_CONNECT" }
  | { type: "CONNECTED"; id: string }
  | { type: "REQUEST_DISCONNECT"; id: string }
  | { type: "CANCEL_DISCONNECT" }
  | { type: "CONFIRM_DISCONNECT" }
  | { type: "START_TEST"; id: string }
  | { type: "END_TEST" }
  | { type: "OPEN_MCP_DIALOG" }
  | { type: "CLOSE_MCP_DIALOG" }
  | { type: "ADD_MCP"; server: McpServer }
  | { type: "REMOVE_MCP"; id: string }

const initialState: IntegrationsState = {
  integrations: AVAILABLE_INTEGRATIONS,
  connectTarget: null,
  connectOpen: false,
  disconnectTarget: null,
  mcpServers: [],
  mcpDialogOpen: false,
  testingId: null,
}

function integrationsReducer(state: IntegrationsState, action: IntegrationsAction): IntegrationsState {
  switch (action.type) {
    case "OPEN_CONNECT": {
      return { ...state, connectTarget: action.target, connectOpen: true }
    }
    case "CLOSE_CONNECT": {
      return { ...state, connectOpen: false }
    }
    case "CONNECTED": {
      return {
        ...state,
        integrations: state.integrations.map((i) =>
          i.id === action.id
            ? {
                ...i,
                connected: true,
                secretRef: `secrets/${action.id}.yaml`,
                agents: ["ceo"],
                connectedAt: new Date().toISOString(),
              }
            : i,
        ),
      }
    }
    case "REQUEST_DISCONNECT": {
      return { ...state, disconnectTarget: action.id }
    }
    case "CANCEL_DISCONNECT": {
      return { ...state, disconnectTarget: null }
    }
    case "CONFIRM_DISCONNECT": {
      return {
        ...state,
        integrations: state.integrations.map((i) =>
          i.id === state.disconnectTarget
            ? { ...i, connected: false, secretRef: undefined, agents: undefined, connectedAt: undefined }
            : i,
        ),
        disconnectTarget: null,
      }
    }
    case "START_TEST": {
      return { ...state, testingId: action.id }
    }
    case "END_TEST": {
      return { ...state, testingId: null }
    }
    case "OPEN_MCP_DIALOG": {
      return { ...state, mcpDialogOpen: true }
    }
    case "CLOSE_MCP_DIALOG": {
      return { ...state, mcpDialogOpen: false }
    }
    case "ADD_MCP": {
      return { ...state, mcpServers: [...state.mcpServers, action.server], mcpDialogOpen: false }
    }
    case "REMOVE_MCP": {
      return { ...state, mcpServers: state.mcpServers.filter((s) => s.id !== action.id) }
    }
  }
}

// --- Sub-components ---

function DisconnectDialog({
  disconnectTarget,
  integrations,
  onCancel,
  onConfirm,
}: {
  disconnectTarget: string | null
  integrations: IntegrationInfo[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={disconnectTarget !== null}
      onOpenChange={(open) => !open && onCancel()}
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
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-none"
            onClick={onConfirm}
          >
            {t("integrations.disconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const mcpSchema = z.object({
  url: z.string().min(1, "URL or package name is required"),
})

type McpFormValues = z.infer<typeof mcpSchema>

function AddMcpDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (server: McpServer) => void
}) {
  const { t } = useTranslation()
  const mcpForm = useForm<McpFormValues>({
    resolver: zodResolver(mcpSchema),
    defaultValues: { url: "" },
  })

  const handleSubmit = useCallback(
    (values: McpFormValues) => {
      const server: McpServer = {
        id: crypto.randomUUID(),
        url: values.url,
        addedAt: new Date().toISOString(),
      }
      onAdd(server)
      mcpForm.reset()
    },
    [onAdd, mcpForm],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm">
            {t("integrations.mcp_add")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={mcpForm.handleSubmit(handleSubmit)} className="flex flex-col gap-3">
          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("integrations.mcp_url")}
          </label>
          <Input
            {...mcpForm.register("url")}
            ref={(el) => {
              mcpForm.register("url").ref(el)
              if (el) requestAnimationFrame(() => el.focus())
            }}
            placeholder={t("integrations.mcp_url_placeholder")}
            className="rounded-none font-mono text-xs"
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
              onClick={() => onOpenChange(false)}
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
  )
}

function McpServerList({
  servers,
  onRemove,
  onOpenDialog,
}: {
  servers: McpServer[]
  onRemove: (id: string) => void
  onOpenDialog: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlugIcon size={14} className="text-muted-foreground" />
          <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-foreground">
            {t("integrations.mcp_servers")}
          </h2>
          {servers.length > 0 && (
            <Badge variant="outline" className="rounded-none text-[9px]">
              {servers.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 rounded-none font-heading text-[10px]"
          onClick={onOpenDialog}
        >
          <PlusIcon size={12} />
          {t("integrations.mcp_add")}
        </Button>
      </div>

      {servers.length > 0 ? (
        <div className="flex flex-col gap-2">
          {servers.map((server) => (
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
                onClick={() => onRemove(server.id)}
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
  )
}

// --- Main page ---

function IntegrationsPage() {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(integrationsReducer, initialState)

  const { integrations, connectTarget, connectOpen, disconnectTarget, mcpServers, mcpDialogOpen, testingId } = state

  const connectedIntegrations = integrations.filter((i) => i.connected)
  const availableIntegrations = integrations.filter((i) => !i.connected)

  const handleConnect = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id)
      if (!integration) return
      dispatch({ type: "OPEN_CONNECT", target: integration })
    },
    [integrations],
  )

  const handleDisconnect = useCallback((id: string) => {
    dispatch({ type: "REQUEST_DISCONNECT", id })
  }, [])

  const handleTest = useCallback(
    async (id: string) => {
      dispatch({ type: "START_TEST", id })
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1500)
      })
      dispatch({ type: "END_TEST" })
      toast.success(t("integrations.test_success"))
    },
    [t],
  )

  const confirmDisconnect = useCallback(() => {
    const name = integrations.find((i) => i.id === disconnectTarget)?.name ?? disconnectTarget
    dispatch({ type: "CONFIRM_DISCONNECT" })
    toast.success(t("integrations.disconnected", { name }))
  }, [disconnectTarget, integrations, t])

  const handleAddMcp = useCallback(
    (server: McpServer) => {
      dispatch({ type: "ADD_MCP", server })
      toast.success(t("integrations.mcp_added"))
    },
    [t],
  )

  const handleRemoveMcp = useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_MCP", id })
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
            <PlugsIcon size={14} weight="bold" className="text-success" />
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
      <McpServerList
        servers={mcpServers}
        onRemove={handleRemoveMcp}
        onOpenDialog={() => dispatch({ type: "OPEN_MCP_DIALOG" })}
      />

      {/* Connect wizard */}
      <ConnectWizard
        integration={connectTarget}
        open={connectOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_CONNECT" })}
        onConnected={(id) => dispatch({ type: "CONNECTED", id })}
      />

      {/* Disconnect confirmation */}
      <DisconnectDialog
        disconnectTarget={disconnectTarget}
        integrations={integrations}
        onCancel={() => dispatch({ type: "CANCEL_DISCONNECT" })}
        onConfirm={confirmDisconnect}
      />

      {/* MCP add dialog */}
      <AddMcpDialog
        open={mcpDialogOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_MCP_DIALOG" })}
        onAdd={handleAddMcp}
      />
    </div>
  )
}
