import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path: string
  yourContent: string
  currentContent: string
  onKeepMine: () => void
  onKeepTheirs: () => void
  onMergeManually: () => void
}

/**
 * Conflict resolution dialog shown when a 409 is returned on file save.
 * Displays both versions side-by-side.
 */
export function ConflictDialog({
  open,
  onOpenChange,
  path,
  yourContent,
  currentContent,
  onKeepMine,
  onKeepTheirs,
  onMergeManually,
}: ConflictDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-none">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm">
            {t("files.conflict_title")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t("files.conflict_description", { path })}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {/* Your version */}
          <div className="flex flex-col border border-border">
            <div className="border-b border-border bg-primary/5 px-3 py-1.5">
              <span className="font-heading text-[10px] uppercase tracking-widest text-primary">
                {t("files.conflict_yours")}
              </span>
            </div>
            <ScrollArea className="h-64">
              <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground">
                {yourContent}
              </pre>
            </ScrollArea>
          </div>

          {/* Current (server) version */}
          <div className="flex flex-col border border-border">
            <div className="border-b border-border bg-muted/50 px-3 py-1.5">
              <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("files.conflict_theirs")}
              </span>
            </div>
            <ScrollArea className="h-64">
              <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground">
                {currentContent}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onKeepTheirs}>
            {t("files.conflict_keep_theirs")}
          </Button>
          <Button variant="outline" size="sm" onClick={onMergeManually}>
            {t("files.conflict_merge")}
          </Button>
          <Button size="sm" onClick={onKeepMine}>
            {t("files.conflict_keep_mine")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
