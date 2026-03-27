import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/lib/i18n"

interface ShortcutEntry {
  keys: string
  labelKey: string
}

const SHORTCUT_GROUPS: Array<{
  groupKey: string
  shortcuts: ShortcutEntry[]
}> = [
  {
    groupKey: "shortcuts.global",
    shortcuts: [
      { keys: "\u2318K", labelKey: "shortcuts.command_palette" },
      { keys: "\u2318\u21E7C", labelKey: "shortcuts.toggle_chat" },
      { keys: "\u2318\u21E7I", labelKey: "shortcuts.open_inbox" },
      { keys: "\u2318Enter", labelKey: "shortcuts.create_new" },
      { keys: "?", labelKey: "shortcuts.show_help" },
    ],
  },
  {
    groupKey: "shortcuts.navigation",
    shortcuts: [
      { keys: "g d", labelKey: "shortcuts.go_dashboard" },
      { keys: "g t", labelKey: "shortcuts.go_tasks" },
      { keys: "g a", labelKey: "shortcuts.go_team" },
      { keys: "g f", labelKey: "shortcuts.go_files" },
      { keys: "g c", labelKey: "shortcuts.go_chat" },
    ],
  },
  {
    groupKey: "shortcuts.list",
    shortcuts: [
      { keys: "j", labelKey: "shortcuts.next_item" },
      { keys: "k", labelKey: "shortcuts.prev_item" },
      { keys: "Enter", labelKey: "shortcuts.open_selected" },
      { keys: "Escape", labelKey: "shortcuts.close_overlay" },
      { keys: "x", labelKey: "shortcuts.select_item" },
    ],
  },
]

interface KeyboardHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Keyboard shortcuts help overlay, triggered by pressing "?".
 */
export function KeyboardHelpDialog({
  open,
  onOpenChange,
}: KeyboardHelpDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t("shortcuts.title")}
          </DialogTitle>
          <DialogDescription>
            {t("shortcuts.description")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-6 py-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.groupKey}>
                <h3 className="mb-2 font-heading text-xs font-semibold uppercase text-muted-foreground">
                  {t(group.groupKey)}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-foreground">
                        {t(shortcut.labelKey)}
                      </span>
                      <kbd className="flex items-center gap-0.5 rounded-none border border-border bg-muted px-2 py-0.5 font-heading text-[11px] text-muted-foreground">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
