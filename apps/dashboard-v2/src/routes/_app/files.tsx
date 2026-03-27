import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { FileTree } from "@/features/files/file-tree"
import { FileUpload } from "@/components/file-upload"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const Route = createFileRoute("/_app/files")({
  component: FilesLayout,
})

/**
 * Files layout — renders the file tree as a secondary left sidebar.
 * The primary nav compacts to a 56px icon rail when this route is active
 * (handled via CSS class on the app shell based on route match).
 */
function FilesLayout() {
  const { t } = useTranslation()
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0">
      {/* Secondary sidebar: file tree (hidden on mobile) */}
      <div className="hidden md:block">
        <FileTree onUploadClick={() => setUploadOpen(true)} />
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("files.upload")}
            </DialogTitle>
          </DialogHeader>
          <FileUpload
            targetPath="/"
            onUpload={() => setUploadOpen(false)}
            showFolderUpload
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
