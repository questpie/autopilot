import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  HouseIcon,
  ListChecksIcon,
  UsersIcon,
  FolderOpenIcon,
  PaintBrushIcon,
  ChatCircleIcon,
  ChartBarIcon,
  GearIcon,
  LightningIcon,
} from "@phosphor-icons/react"
import { m } from "framer-motion"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useHapticPattern } from "@/hooks/use-haptic"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { EASING, DURATION, clampedDelay, useMotionPreference } from "@/lib/motion"

interface CommandEntry {
  id: string
  labelKey: string
  icon: React.ReactNode
  action: () => void
  category: string
}

/**
 * Command palette overlay triggered by Cmd+K.
 * Provides navigation, agent commands, task actions, and settings access.
 */
export function CommandPalette() {
  const { t } = useTranslation()
  const open = useAppStore((s) => s.commandPaletteOpen)
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const { trigger } = useHapticPattern()
  const { shouldReduce } = useMotionPreference()
  const [inputValue, setInputValue] = useState("")

  const isIntentMode = inputValue.startsWith(">")
  const queryClient = useQueryClient()

  const createIntent = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.api.tasks.$post({
        json: {
          title: message,
          type: "intent",
          assigned_to: "ceo",
          status: "backlog",
          created_by: "human",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      if (!res.ok) throw new Error("Failed to create intent")
      return res.json()
    },
    onSuccess: () => {
      toast.success(t("dashboard.intent_submitted"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  const handleIntentSubmit = useCallback(() => {
    const message = inputValue.slice(1).trim()
    if (!message) return
    trigger("success")
    createIntent.mutate(message)
    setOpen(false)
    setInputValue("")
  }, [inputValue, createIntent, setOpen, trigger])

  const commands = useMemo<CommandEntry[]>(
    () => [
      // Navigate
      {
        id: "nav-dashboard",
        labelKey: "nav.dashboard",
        icon: <HouseIcon size={16} />,
        action: () => void navigate({ to: "/" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-tasks",
        labelKey: "nav.tasks",
        icon: <ListChecksIcon size={16} />,
        action: () => void navigate({ to: "/tasks" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-team",
        labelKey: "nav.team",
        icon: <UsersIcon size={16} />,
        action: () => void navigate({ to: "/team" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-files",
        labelKey: "nav.files",
        icon: <FolderOpenIcon size={16} />,
        action: () => void navigate({ to: "/files" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-artifacts",
        labelKey: "nav.artifacts",
        icon: <PaintBrushIcon size={16} />,
        action: () => void navigate({ to: "/artifacts" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-chat",
        labelKey: "nav.chat",
        icon: <ChatCircleIcon size={16} />,
        action: () => void navigate({ to: "/chat" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-activity",
        labelKey: "nav.activity",
        icon: <ChartBarIcon size={16} />,
        action: () => void navigate({ to: "/activity" }),
        category: "command_palette.navigate",
      },
      {
        id: "nav-settings",
        labelKey: "nav.settings",
        icon: <GearIcon size={16} />,
        action: () => void navigate({ to: "/settings" }),
        category: "command_palette.settings_category",
      },
    ],
    [navigate],
  )

  // Group commands by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandEntry[]>()
    for (const cmd of commands) {
      const group = map.get(cmd.category) ?? []
      group.push(cmd)
      map.set(cmd.category, group)
    }
    return map
  }, [commands])

  const handleSelect = useCallback(
    (commandId: string) => {
      const cmd = commands.find((c) => c.id === commandId)
      if (cmd) {
        trigger("tap")
        cmd.action()
        setOpen(false)
        setInputValue("")
      }
    },
    [commands, setOpen, trigger],
  )

  const bindings = useMemo(
    () => ({
      "$mod+k": (e: KeyboardEvent) => {
        e.preventDefault()
        setOpen(!open)
      },
    }),
    [open, setOpen],
  )

  useKeyboardShortcuts(bindings)

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setInputValue("")
      }}
      title={t("command_palette.placeholder")}
      description={
        isIntentMode ? t("command_palette.intent_hint") : undefined
      }
    >
      <CommandList>
        {isIntentMode ? (
          <CommandGroup heading={t("command_palette.intent_hint")}>
            <CommandItem
              value="submit-intent"
              onSelect={handleIntentSubmit}
            >
              <LightningIcon size={16} className="text-primary" />
              <span>
                {inputValue.slice(1).trim() || t("command_palette.placeholder")}
              </span>
            </CommandItem>
          </CommandGroup>
        ) : (
          <>
            <CommandEmpty>{t("command_palette.no_results")}</CommandEmpty>
            {Array.from(grouped.entries()).map(([category, items]) => {
              let itemIndex = 0
              return (
                <CommandGroup key={category} heading={t(category)}>
                  {items.map((item) => {
                    const delay = shouldReduce ? 0 : clampedDelay(itemIndex++)
                    return (
                      <m.div
                        key={item.id}
                        initial={shouldReduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: DURATION.normal,
                          ease: EASING.enter,
                          delay,
                        }}
                      >
                        <CommandItem
                          value={item.id}
                          onSelect={handleSelect}
                        >
                          {item.icon}
                          <span>{t(item.labelKey)}</span>
                        </CommandItem>
                      </m.div>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
