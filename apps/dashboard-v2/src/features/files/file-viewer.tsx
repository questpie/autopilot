import { Suspense, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveView, isBinaryFile } from "@/lib/view-registry"
import { fileContentQuery } from "./files.queries"
import { RawViewToggle } from "./raw-view-toggle"
import { CodeViewFallback } from "./views/code-view"

interface FileViewerProps {
  /** Relative file path within company root */
  path: string
}

/**
 * View dispatcher — resolves the best viewer for a file path
 * from the view registry and renders it with a "Raw" toggle.
 */
export function FileViewer({ path }: FileViewerProps) {
  const { t } = useTranslation()
  const [isRaw, setIsRaw] = useState(false)

  const isBinary = isBinaryFile(path)

  // Only fetch text content for non-binary files
  const { data: content, isLoading, error } = useQuery({
    ...fileContentQuery(path),
    enabled: !isBinary,
  })

  const registration = resolveView(path)

  if (isLoading && !isBinary) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-6 w-48 rounded-none" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <p className="font-heading text-sm text-destructive">{t("common.error")}</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const fileContent = content ?? ""

  // Raw view: show plain text
  if (isRaw && !isBinary) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-heading text-xs text-muted-foreground">
            {registration?.label ?? t("files.raw")}
          </span>
          <RawViewToggle isRaw={isRaw} onToggle={setIsRaw} />
        </div>
        <CodeViewFallback path={path} content={fileContent} />
      </div>
    )
  }

  // No registration — show raw
  if (!registration) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-heading text-xs text-muted-foreground">
            {t("files.raw")}
          </span>
        </div>
        <CodeViewFallback path={path} content={fileContent} />
      </div>
    )
  }

  const ViewComponent = registration.component

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-heading text-xs text-muted-foreground">
          {registration.label}
        </span>
        {!isBinary && <RawViewToggle isRaw={isRaw} onToggle={setIsRaw} />}
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-6 w-48 rounded-none" />
            <Skeleton className="h-64 w-full rounded-none" />
          </div>
        }
      >
        <ViewComponent path={path} content={fileContent} />
      </Suspense>
    </div>
  )
}
