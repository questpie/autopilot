import { useState, useCallback, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  TrashIcon,
  CopySimpleIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PencilSimpleIcon,
  ArrowsLeftRightIcon,
  CopyIcon,
  StarIcon,
  UploadSimpleIcon,
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
import {
  useDeleteFile,
  useCreateFile,
  useRenameFile,
  useMoveFile,
  useDuplicateFile,
  useCreateDirectory,
} from "./files.mutations"
import { useQuickAccessStore } from "./quick-access.store"

interface FileTreeContextMenuProps {
  path: string
  isDirectory: boolean
  children: React.ReactNode
}

type ActiveDialog =
  | "delete"
  | "new-file"
  | "new-folder"
  | "rename"
  | "move"
  | null

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"

export function FileTreeContextMenu({
  path,
  isDirectory,
  children,
}: FileTreeContextMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const deleteFile = useDeleteFile()
  const createFile = useCreateFile()
  const renameFile = useRenameFile()
  const moveFile = useMoveFile()
  const duplicateFile = useDuplicateFile()
  const createDirectory = useCreateDirectory()
  const toggleQuickAccess = useQuickAccessStore((s) => s.toggle)
  const isStarred = useQuickAccessStore((s) => s.paths.includes(path))
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [newFileName, setNewFileName] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [renameName, setRenameName] = useState("")
  const [movePath, setMovePath] = useState("")
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => setMenuPos(null), [])

  const parentDir = isDirectory
    ? path
    : path.split("/").slice(0, -1).join("/")

  const currentName = path.split("/").pop() ?? ""

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
          setActiveDialog(null)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleCreateFile = () => {
    if (!newFileName.trim()) return
    const filePath = parentDir
      ? `${parentDir}/${newFileName}`
      : newFileName
    createFile.mutate(
      { path: filePath, content: "" },
      {
        onSuccess: () => {
          toast.success(t("files.file_created"))
          setActiveDialog(null)
          setNewFileName("")
          void navigate({ to: "/files/$", params: { _splat: filePath } })
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    const folderPath = parentDir
      ? `${parentDir}/${newFolderName}`
      : newFolderName
    createDirectory.mutate(
      { path: folderPath },
      {
        onSuccess: () => {
          toast.success(t("files.folder_created"))
          setActiveDialog(null)
          setNewFolderName("")
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleRename = () => {
    if (!renameName.trim() || renameName === currentName) return
    const dir = path.split("/").slice(0, -1).join("/")
    const newPath = dir ? `${dir}/${renameName}` : renameName
    renameFile.mutate(
      { oldPath: path, newPath, content: "" },
      {
        onSuccess: () => {
          toast.success(t("files.file_renamed"))
          setActiveDialog(null)
          setRenameName("")
          void navigate({ to: "/files/$", params: { _splat: newPath } })
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleMove = () => {
    if (!movePath.trim()) return
    const targetPath = movePath.endsWith("/")
      ? `${movePath}${currentName}`
      : `${movePath}/${currentName}`
    moveFile.mutate(
      { sourcePath: path, targetPath },
      {
        onSuccess: () => {
          toast.success(t("files.file_moved"))
          setActiveDialog(null)
          setMovePath("")
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleDuplicate = () => {
    const ext = currentName.includes(".")
      ? `.${currentName.split(".").pop()}`
      : ""
    const baseName = ext
      ? currentName.slice(0, -ext.length)
      : currentName
    const dir = path.split("/").slice(0, -1).join("/")
    const duplicateName = `${baseName}-copy${ext}`
    const targetPath = dir ? `${dir}/${duplicateName}` : duplicateName
    duplicateFile.mutate(
      { sourcePath: path, targetPath },
      {
        onSuccess: () => {
          toast.success(t("files.file_duplicated"))
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const handleUpload = () => {
    closeMenu()
    uploadInputRef.current?.click()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content =
        typeof reader.result === "string" ? reader.result : ""
      const filePath = parentDir
        ? `${parentDir}/${file.name}`
        : file.name
      createFile.mutate(
        { path: filePath, content },
        {
          onSuccess: () => {
            toast.success(t("files.file_created"))
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    }
    reader.readAsText(file)
    // Reset so the same file can be uploaded again
    e.target.value = ""
  }

  const handleToggleQuickAccess = () => {
    toggleQuickAccess(path)
    closeMenu()
  }

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div onContextMenu={handleContextMenu}>{children}</div>

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
            className="fixed z-50 min-w-[180px] border border-border bg-popover py-1 shadow-md"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {isDirectory && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    setActiveDialog("new-file")
                  }}
                  className={MENU_ITEM_CLASS}
                >
                  <FilePlusIcon size={14} />
                  {t("files.create_file")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    setActiveDialog("new-folder")
                  }}
                  className={MENU_ITEM_CLASS}
                >
                  <FolderPlusIcon size={14} />
                  {t("files.new_folder")}
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  className={MENU_ITEM_CLASS}
                >
                  <UploadSimpleIcon size={14} />
                  {t("files.upload")}
                </button>
                <div className="my-1 border-t border-border" />
              </>
            )}

            <button
              type="button"
              onClick={() => {
                closeMenu()
                setRenameName(currentName)
                setActiveDialog("rename")
              }}
              className={MENU_ITEM_CLASS}
            >
              <PencilSimpleIcon size={14} />
              {t("files.rename")}
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                setMovePath("")
                setActiveDialog("move")
              }}
              className={MENU_ITEM_CLASS}
            >
              <ArrowsLeftRightIcon size={14} />
              {t("files.move")}
            </button>
            {!isDirectory && (
              <button
                type="button"
                onClick={() => {
                  handleDuplicate()
                  closeMenu()
                }}
                className={MENU_ITEM_CLASS}
              >
                <CopyIcon size={14} />
                {t("files.duplicate")}
              </button>
            )}

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={handleCopyPath}
              className={MENU_ITEM_CLASS}
            >
              <CopySimpleIcon size={14} />
              {t("files.copy_path")}
            </button>
            <button
              type="button"
              onClick={handleToggleQuickAccess}
              className={MENU_ITEM_CLASS}
            >
              <StarIcon size={14} weight={isStarred ? "fill" : "regular"} />
              {isStarred
                ? t("files.remove_from_quick_access")
                : t("files.add_to_quick_access")}
            </button>

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() => {
                closeMenu()
                setActiveDialog("delete")
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-destructive hover:bg-muted/50"
            >
              <TrashIcon size={14} />
              {t("files.delete")}
            </button>
          </div>
        </>
      )}

      <Dialog
        open={activeDialog === "delete"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
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
              onClick={() => setActiveDialog(null)}
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

      <Dialog
        open={activeDialog === "new-file"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
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
              onClick={() => setActiveDialog(null)}
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

      <Dialog
        open={activeDialog === "new-folder"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.new_folder")}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t("files.folder_name_placeholder")}
            className="rounded-none font-heading text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={createDirectory.isPending || !newFolderName.trim()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "rename"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.rename_title")}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder={t("files.rename_placeholder")}
            className="rounded-none font-heading text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleRename}
              disabled={
                renameFile.isPending ||
                !renameName.trim() ||
                renameName === currentName
              }
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "move"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.move_title")}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={movePath}
            onChange={(e) => setMovePath(e.target.value)}
            placeholder={t("files.move_placeholder")}
            className="rounded-none font-heading text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMove()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleMove}
              disabled={moveFile.isPending || !movePath.trim()}
            >
              {t("files.move")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
