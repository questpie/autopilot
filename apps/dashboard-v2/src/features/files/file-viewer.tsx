import { Suspense, useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { FloppyDiskIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { resolveView, isBinaryFile } from "@/lib/view-registry"
import { fileContentQuery } from "./files.queries"
import { useUpdateFile } from "./files.mutations"
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

type ViewerTab = "preview" | "edit" | "raw"

function FileEditPanel({
  path,
  content,
  editContent,
  onEditContentChange,
}: {
  path: string
  content: string
  editContent: string
  onEditContentChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const updateFile = useUpdateFile()

  const isDirty = editContent !== content

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Button
          variant="default"
          size="sm"
          disabled={!isDirty || updateFile.isPending}
          onClick={() => updateFile.mutate({ path, content: editContent })}
          className="h-6 gap-1 px-2 text-[10px]"
        >
          <FloppyDiskIcon size={12} />
          {updateFile.isPending ? t("common.loading") : t("common.save")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!isDirty || updateFile.isPending}
          onClick={() => {
            onEditContentChange(content)
            textareaRef.current?.focus()
          }}
          className="h-6 gap-1 px-2 text-[10px]"
        >
          <ArrowCounterClockwiseIcon size={12} />
          {t("files.discard")}
        </Button>

        {updateFile.isError && (
          <span className="text-[10px] text-destructive">
            {t("files.save_error")}
          </span>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => onEditContentChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-background p-4 font-mono text-xs leading-5 text-foreground outline-none"
      />
    </div>
  )
}

/**
 * View dispatcher — resolves the best viewer for a file path
 * from the view registry and renders it with Preview/Edit/Raw tabs.
 */
export function FileViewer({ path }: FileViewerProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ViewerTab>("preview")
  const [editContent, setEditContent] = useState("")

  const isBinary = isBinaryFile(path)

  const { data: content, isLoading, error } = useQuery({
    ...fileContentQuery(path),
    enabled: !isBinary,
  })

  const registration = resolveView(path)
  const fileContent = content ?? ""

  // Sync edit buffer when source content changes (initial load or after save)
  useEffect(() => {
    setEditContent(fileContent)
  }, [fileContent])

  const isDirty = editContent !== fileContent

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

  // Binary files: no tabs, just show the viewer directly
  if (isBinary) {
    if (!registration) {
      return (
        <div className="flex flex-col">
          <ViewerHeader label={t("files.raw")} />
          <CodeViewFallback path={path} content={fileContent} />
        </div>
      )
    }

    const ViewComponent = registration.component
    return (
      <div className="flex flex-col">
        <ViewerHeader label={registration.label} />
        <Suspense fallback={<ViewerSkeleton />}>
          <ViewComponent path={path} content={fileContent} />
        </Suspense>
      </div>
    )
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(val) => setActiveTab(val)}
      className="flex flex-1 flex-col"
    >
      <div className="flex items-center border-b border-border px-4">
        <span className="mr-3 font-heading text-xs text-muted-foreground">
          {registration?.label ?? t("files.raw")}
        </span>
        <TabsList variant="line" className="h-8">
          {registration && (
            <TabsTrigger value="preview">
              {t("files.tab_preview")}
            </TabsTrigger>
          )}
          <TabsTrigger value="edit" className="gap-1">
            {t("files.tab_edit")}
            {isDirty && (
              <span className="size-1.5 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="raw">
            {t("files.tab_raw")}
          </TabsTrigger>
        </TabsList>
      </div>

      {registration && (
        <TabsContent value="preview" className="flex flex-1 flex-col">
          <Suspense fallback={<ViewerSkeleton />}>
            <registration.component path={path} content={fileContent} />
          </Suspense>
        </TabsContent>
      )}

      <TabsContent value="edit" className="flex flex-1 flex-col">
        <FileEditPanel
          path={path}
          content={fileContent}
          editContent={editContent}
          onEditContentChange={setEditContent}
        />
      </TabsContent>

      <TabsContent value="raw" className="flex flex-1 flex-col">
        <CodeViewFallback path={path} content={fileContent} />
      </TabsContent>
    </Tabs>
  )
}
