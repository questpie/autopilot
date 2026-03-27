import { CodeIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RawViewToggleProps {
  isRaw: boolean
  onToggle: (raw: boolean) => void
  className?: string
}

/**
 * Toggle button that switches between a rendered view and raw file content.
 * Present on every file viewer.
 */
export function RawViewToggle({ isRaw, onToggle, className }: RawViewToggleProps) {
  const { t } = useTranslation()

  return (
    <Button
      variant={isRaw ? "default" : "outline"}
      size="sm"
      onClick={() => onToggle(!isRaw)}
      className={cn("gap-1.5 rounded-none font-heading text-[10px]", className)}
    >
      <CodeIcon size={12} />
      {isRaw ? t("files.view_rendered") : t("files.view_raw")}
    </Button>
  )
}
