import { Link, useMatches } from "@tanstack/react-router"
import {
  BookOpenIcon,
  ArrowsClockwiseIcon,
  WrenchIcon,
  FolderOpenIcon,
  GearSixIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Bookmark {
  labelKey: string
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill"; className?: string }>
  path: string
}

const BOOKMARKS: Bookmark[] = [
  { labelKey: "files.bookmark_knowledge", icon: BookOpenIcon, path: "knowledge" },
  { labelKey: "files.bookmark_workflows", icon: ArrowsClockwiseIcon, path: "workflows" },
  { labelKey: "files.bookmark_skills", icon: WrenchIcon, path: "skills" },
  { labelKey: "files.bookmark_projects", icon: FolderOpenIcon, path: "projects" },
  { labelKey: "files.bookmark_config", icon: GearSixIcon, path: "" },
]

export function FileTreeBookmarks() {
  const { t } = useTranslation()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? ""

  return (
    <div className="flex flex-col gap-0.5 border-b border-border px-2 pb-2 pt-1">
      <span className="px-2 py-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("files.quick_access")}
      </span>
      {BOOKMARKS.map((bm) => {
        const to = bm.path ? `/files/${bm.path}` : "/files"
        const isActive = bm.path
          ? currentPath.includes(`/files/${bm.path}`)
          : currentPath === "/files" || currentPath === "/files/"
        const Icon = bm.icon

        return (
          <Link
            key={bm.path || "root"}
            to={to}
            className={cn(
              "flex items-center gap-2 px-2 py-1 font-heading text-xs transition-colors",
              isActive
                ? "bg-primary/5 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon size={14} weight={isActive ? "fill" : "regular"} />
            <span className="truncate">{t(bm.labelKey)}</span>
          </Link>
        )
      })}
    </div>
  )
}
