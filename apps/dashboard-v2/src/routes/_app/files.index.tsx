import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { FolderOpenIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { directoryQuery } from "@/features/files/files.queries"
import { DirectoryListing } from "@/features/files/directory-listing"
import { BreadcrumbNav } from "@/features/files/breadcrumb-nav"
import { EmptyState } from "@/components/feedback/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_app/files/")({
  component: FilesIndex,
})

/**
 * Files index — shows root directory listing.
 */
function FilesIndex() {
  const { t } = useTranslation()
  const { data: entries, isLoading } = useQuery(directoryQuery(""))

  return (
    <div className="flex flex-col">
      <BreadcrumbNav path="" />

      {isLoading && (
        <div className="flex flex-col gap-1 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-none" />
          ))}
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && (
        <DirectoryListing entries={entries} parentPath="" />
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <EmptyState
          icon={<FolderOpenIcon size={32} />}
          message={t("files.no_files")}
          description={t("files.no_files_description")}
        />
      )}
    </div>
  )
}
