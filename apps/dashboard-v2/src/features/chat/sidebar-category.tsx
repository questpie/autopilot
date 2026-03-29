import { memo, useCallback } from "react"
import { CaretDownIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface CategoryHeaderProps {
  label: string
  collapsed: boolean
  categoryKey: string
  onToggleCategory: (key: string) => void
  action?: React.ReactNode
}

export const CategoryHeader = memo(function CategoryHeader({
  label,
  collapsed,
  categoryKey,
  onToggleCategory,
  action,
}: CategoryHeaderProps) {
  const handleToggle = useCallback(() => {
    onToggleCategory(categoryKey)
  }, [onToggleCategory, categoryKey])

  return (
    <div className="group flex items-center px-2 pt-4 pb-0.5">
      <button
        type="button"
        onClick={handleToggle}
        className="flex flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretDownIcon
          size={10}
          className={cn(
            "shrink-0 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
        {label}
      </button>
      {action && (
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          {action}
        </span>
      )}
    </div>
  )
})
