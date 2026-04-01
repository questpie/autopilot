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
import { BottomSheet } from "@/components/mobile/bottom-sheet"
import { useLongPress } from "@/hooks/use-long-press"
import { useDeleteFile, useCreateFile } from "./files.mutations"

interface FileTreeContextMenuProps {
  path: string
  isDirectory: boolean
  children: React.ReactNode
}

interface MenuAction {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  destructive?: boolean
}

/**
 * Context menu wrapper for file tree items.
 * Desktop: right-click shows a floating context menu.
 * Mobile: long-press opens a bottom sheet with the same actions.
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => {
    setMenuPos(null)
    setMobileMenuOpen(false)
  }, [])

  const longPressHandlers = useLongPress({
    duration: 500,
    onLongPress: () => {
      setMobileMenuOpen(true)
    },
  })

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

  const menuActions: MenuAction[] = [
    ...(isDirectory
      ? [
          {
            icon: FilePlusIcon,
            label: t("files.create_file"),
            onClick: () => {
              closeMenu()
              setShowNewFileDialog(true)
            },
          },
        ]
      : []),
    {
      icon: CopySimpleIcon,
      label: t("files.copy_path"),
      onClick: handleCopyPath,
    },
    {
      icon: TrashIcon,
      label: t("files.delete"),
      onClick: () => {
        closeMenu()
        setShowDeleteDialog(true)
      },
      destructive: true,
    },
  ]

  return (
    <>
      {/* Wrap children with context menu + long-press handlers */}
      <div
        onContextMenu={handleContextMenu}
        {...longPressHandlers}
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>

      {/* Desktop: floating context menu popup */}
      {menuPos && (
        <>
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
            {menuActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs hover:bg-muted/50",
                    action.destructive ? "text-destructive" : "text-foreground",
                  ].join(" ")}
                >
                  <Icon size={14} />
                  {action.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Mobile: bottom sheet context menu */}
      <BottomSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        snapPoints={[0.3]}
      >
        <nav className="flex flex-col gap-1">
          <p className="truncate px-4 pb-2 font-heading text-xs text-muted-foreground">
            {path}
          </p>
          {menuActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={[
                  "flex min-h-[44px] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted",
                  action.destructive ? "text-destructive" : "text-foreground",
                ].join(" ")}
              >
                <Icon size={20} />
                <span className="font-heading">{action.label}</span>
              </button>
            )
          })}
        </nav>
      </BottomSheet>

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
