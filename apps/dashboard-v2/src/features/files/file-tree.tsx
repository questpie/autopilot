import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { UploadSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { queryKeys } from "@/lib/query-keys"
import { directoryQuery } from "./files.queries"
import { FileTreeBookmarks } from "./file-tree-bookmarks"
import { FileTreeItem } from "./file-tree-item"
import { ContextNewButton } from "./context-new-button"
import { useMoveFile } from "./files.mutations"
import { cn } from "@/lib/utils"

interface FileTreeProps {
  className?: string
  onUploadClick?: () => void
}

/**
 * File tree panel — secondary left sidebar for the /files routes.
 * Shows bookmarks at top, then the full directory tree.
 */
export function FileTree({ className, onUploadClick }: FileTreeProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: rootEntries } = useSuspenseQuery(directoryQuery(""))
  const moveFile = useMoveFile()

  // Native drag-drop upload handling
  const [isDragOver, setIsDragOver] = useState(false)
  // DnD Kit: track actively dragged item
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleNativeDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      onUploadClick?.()
    },
    [onUploadClick],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const sourcePath = active.id as string
      const targetDir = over.id as string
      const fileName = sourcePath.split("/").pop() ?? ""
      const destPath = targetDir ? `${targetDir}/${fileName}` : fileName

      if (sourcePath === destPath) return

      moveFile.mutate(
        { sourcePath, targetPath: destPath, content: "" },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
            toast.success(t("files.file_moved"))
          },
          onError: (err) => toast.error(err.message),
        },
      )
    },
    [moveFile, queryClient, t],
  )

  const sortedEntries = rootEntries
    ? [...rootEntries].sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    : []

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className={cn(
          "flex h-full w-[240px] shrink-0 flex-col border-r border-border bg-sidebar",
          isDragOver && "ring-2 ring-inset ring-primary",
          className,
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleNativeDrop}
      >
        <FileTreeBookmarks />

        <div className="px-2 py-1">
          <span className="px-2 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("files.all_files")}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="pb-2">
            {sortedEntries.map((entry) => (
              <FileTreeItem
                key={entry.name}
                entry={entry}
                parentPath=""
                depth={0}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Bottom actions */}
        <div className="flex gap-1 border-t border-border p-2">
          <ContextNewButton currentDir="" />
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 rounded-none font-heading text-[10px]"
            onClick={onUploadClick}
          >
            <UploadSimpleIcon size={12} />
            {t("files.upload")}
          </Button>
        </div>
      </div>

      {/* DnD drag overlay */}
      <DragOverlay>
        {activeDragId ? (
          <div className="rounded-none border border-primary bg-card px-3 py-1 font-heading text-xs text-foreground shadow-md">
            {activeDragId.split("/").pop()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
