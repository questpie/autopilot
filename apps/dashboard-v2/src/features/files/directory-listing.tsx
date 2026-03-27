import { useState, useCallback } from "react"
import { Link } from "@tanstack/react-router"
import {
  FolderSimpleIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileCodeIcon,
  FileLockIcon,
  FilePdfIcon,
  FileDocIcon,
  SortAscendingIcon,
  SortDescendingIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { FsEntry } from "./files.queries"
import type { Icon } from "@phosphor-icons/react"

function getEntryIcon(entry: FsEntry, parentPath: string): Icon {
  if (entry.type === "directory") return FolderSimpleIcon

  const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""
  if (parentPath.startsWith("secrets")) return FileLockIcon
  if (["md", "txt"].includes(ext)) return FileTextIcon
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return FileImageIcon
  if (["ts", "tsx", "js", "jsx", "css", "html"].includes(ext)) return FileCodeIcon
  if (ext === "pdf") return FilePdfIcon
  if (["yaml", "yml", "json"].includes(ext)) return FileDocIcon
  return FileIcon
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type SortKey = "name" | "size" | "type"
type SortDir = "asc" | "desc"

interface DirectoryListingProps {
  entries: FsEntry[]
  parentPath: string
  className?: string
}

/**
 * Directory listing table with sorting.
 * Shows name, type icon, size for each entry.
 */
export function DirectoryListing({
  entries,
  parentPath,
  className,
}: DirectoryListingProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Drop handler for file upload
  const [isDragOver, setIsDragOver] = useState(false)

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir("asc")
      }
    },
    [sortKey],
  )

  const sorted = [...entries].sort((a, b) => {
    // Directories always first
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1

    let cmp = 0
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name)
        break
      case "size":
        cmp = a.size - b.size
        break
      case "type": {
        const extA = a.name.split(".").pop() ?? ""
        const extB = b.name.split(".").pop() ?? ""
        cmp = extA.localeCompare(extB)
        break
      }
    }
    return sortDir === "asc" ? cmp : -cmp
  })

  const SortIcon = sortDir === "asc" ? SortAscendingIcon : SortDescendingIcon

  return (
    <div
      className={cn("flex flex-col", isDragOver && "ring-2 ring-inset ring-primary", className)}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
      }}
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={() => handleSort("name")}
          className="flex flex-1 items-center gap-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("files.column_name")}
          {sortKey === "name" && <SortIcon size={10} />}
        </button>
        <button
          type="button"
          onClick={() => handleSort("size")}
          className="flex w-20 items-center justify-end gap-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("files.column_size")}
          {sortKey === "size" && <SortIcon size={10} />}
        </button>
      </div>

      {/* Entries */}
      {sorted.map((entry) => {
        const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
        const EntryIcon = getEntryIcon(entry, parentPath)

        return (
          <Link
            key={entry.name}
            to="/files/$"
            params={{ _splat: fullPath }}
            className="flex items-center gap-3 border-b border-border/50 px-4 py-2 transition-colors hover:bg-muted/50"
          >
            <EntryIcon size={16} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-heading text-xs text-foreground">
              {entry.name}
            </span>
            <span className="w-20 text-right font-heading text-[10px] text-muted-foreground tabular-nums">
              {entry.type === "directory" ? "-" : formatSize(entry.size)}
            </span>
          </Link>
        )
      })}

      {/* FileIcon count */}
      <div className="px-4 py-2">
        <span className="font-heading text-[10px] text-muted-foreground">
          {t("files.file_count", { count: entries.length })}
        </span>
      </div>
    </div>
  )
}
