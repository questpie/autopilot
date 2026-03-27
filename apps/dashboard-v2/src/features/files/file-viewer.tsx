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

function ViewerSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function ViewerHeader({
  label,
  children,
}: {
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <span className="font-heading text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
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
    return <ViewerSkeleton />
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

  // Raw view or no registration: show plain text
  if ((isRaw && !isBinary) || !registration) {
    return (
      <div className="flex flex-col">
        <ViewerHeader label={registration?.label ?? t("files.raw")}>
          {registration && <RawViewToggle isRaw={isRaw} onToggle={setIsRaw} />}
        </ViewerHeader>
        <CodeViewFallback path={path} content={fileContent} />
      </div>
    )
  }

  const ViewComponent = registration.component

  return (
    <div className="flex flex-col">
      <ViewerHeader label={registration.label}>
        {!isBinary && <RawViewToggle isRaw={isRaw} onToggle={setIsRaw} />}
      </ViewerHeader>
      <Suspense fallback={<ViewerSkeleton />}>
        <ViewComponent path={path} content={fileContent} />
      </Suspense>
    </div>
  )
}
