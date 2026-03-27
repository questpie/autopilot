import { cn } from "@/lib/utils"

interface FormActionsProps {
  children: React.ReactNode
  className?: string
  align?: "left" | "right" | "between"
}

/**
 * Button row for form submit/cancel actions.
 */
export function FormActions({
  children,
  className,
  align = "right",
}: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 pt-2",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        align === "between" && "justify-between",
        className,
      )}
    >
      {children}
    </div>
  )
}
