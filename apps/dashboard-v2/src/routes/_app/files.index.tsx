import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { FolderOpenIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { directoryQuery } from "@/features/files/files.queries"
import { DirectoryListing } from "@/features/files/directory-listing"
import { BreadcrumbNav } from "@/features/files/breadcrumb-nav"
import { EmptyState } from "@/components/feedback/empty-state"

export const Route = createFileRoute("/_app/files/")({
  component: FilesIndex,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(directoryQuery(""))
  },
})

/**
 * Files index — shows root directory listing.
 */
function FilesIndex() {
  const { t } = useTranslation()
  const { data: entries } = useSuspenseQuery(directoryQuery(""))

  return (
    <div className="flex flex-col">
      <BreadcrumbNav path="" />

      {entries && entries.length > 0 && (
        <DirectoryListing entries={entries} parentPath="" />
      )}

      {(!entries || entries.length === 0) && (
        <EmptyState
          icon={<FolderOpenIcon size={32} />}
          message={t("files.no_files")}
          description={t("files.no_files_description")}
        />
      )}
    </div>
  )
}
