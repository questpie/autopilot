import { Link } from "@tanstack/react-router"
import { CaretRightIcon, HouseIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"

interface BreadcrumbNavProps {
  /** Current file/directory path relative to company root */
  path: string
}

/**
 * Breadcrumb navigation for the file browser.
 * Each segment is clickable and navigates to that directory.
 */
export function BreadcrumbNav({ path }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const segments = path.split("/").filter(Boolean)

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto px-4 py-2 font-heading text-xs"
      aria-label={t("a11y.breadcrumb")}
    >
      <Link
        to="/files"
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <HouseIcon size={12} />
        <span>{t("files.root")}</span>
      </Link>

      {segments.map((segment, index) => {
        const partialPath = segments.slice(0, index + 1).join("/")
        const isLast = index === segments.length - 1

        return (
          <span key={partialPath} className="flex items-center gap-1">
            <CaretRightIcon size={10} className="text-muted-foreground/50" />
            {isLast ? (
              <span className="text-foreground">{segment}</span>
            ) : (
              <Link
                to="/files/$"
                params={{ _splat: partialPath }}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {segment}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
