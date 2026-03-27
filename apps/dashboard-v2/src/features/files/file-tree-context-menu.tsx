import { useState, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  TrashIcon,
  CopySimpleIcon,
  FilePlusIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useDeleteFile, useCreateFile } from "./files.mutations"

interface FileTreeContextMenuProps {
  path: string
  isDirectory: boolean
  children: React.ReactNode
}

/**
 * Context menu wrapper for file tree items.
 * Shows a native-style right-click menu with file operations.
 */
export function FileTreeContextMenu({
  path,
  isDirectory,
  children,
}: FileTreeContextMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const deleteFile = useDeleteFile()
  const createFile = useCreateFile()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => setMenuPos(null), [])

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(path)
    toast.success(t("common.copied"))
    closeMenu()
  }

  const handleDelete = () => {
    deleteFile.mutate(
      { path },
      {
        onSuccess: () => {
          toast.success(t("files.file_deleted"))
          setShowDeleteDialog(false)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleCreateFile = () => {
    if (!newFileName.trim()) return
    const targetDir = isDirectory ? path : path.split("/").slice(0, -1).join("/")
    const filePath = targetDir ? `${targetDir}/${newFileName}` : newFileName
    createFile.mutate(
      { path: filePath, content: "" },
      {
        onSuccess: () => {
          toast.success(t("files.file_created"))
          setShowNewFileDialog(false)
          setNewFileName("")
          void navigate({ to: "/files/$", params: { _splat: filePath } })
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  return (
    <>
      {/* Wrap children with context menu handler */}
      <div onContextMenu={handleContextMenu}>
        {children}
      </div>

      {/* Custom context menu popup */}
      {menuPos && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-50"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeMenu()
            }}
          />
          <div
            className="fixed z-50 min-w-[160px] border border-border bg-popover py-1 shadow-md"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {isDirectory && (
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  setShowNewFileDialog(true)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"
              >
                <FilePlusIcon size={14} />
                {t("files.create_file")}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyPath}
              className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"
            >
              <CopySimpleIcon size={14} />
              {t("files.copy_path")}
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                closeMenu()
                setShowDeleteDialog(true)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-destructive hover:bg-muted/50"
            >
              <TrashIcon size={14} />
              {t("files.delete")}
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.delete_confirm_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t("files.delete_confirm_message", { path })}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteFile.isPending}
            >
              {t("files.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New file dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.create_file")}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder={t("files.filename_placeholder")}
            className="rounded-none font-heading text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFile()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFileDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFile}
              disabled={createFile.isPending || !newFileName.trim()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
