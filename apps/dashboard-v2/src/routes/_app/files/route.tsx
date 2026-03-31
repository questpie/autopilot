import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { FileTree } from "@/features/files/file-tree"
import { FileUpload } from "@/components/file-upload"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageError } from "@/components/feedback"

export const Route = createFileRoute("/_app/files")({
  component: FilesLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
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
        <Suspense
          fallback={
            <div className="flex w-[240px] flex-col gap-1 border-r border-border bg-sidebar p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-none" />
              ))}
            </div>
          }
        >
          <FileTree onUploadClick={() => setUploadOpen(true)} />
        </Suspense>
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
