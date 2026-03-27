import { cn } from "@/lib/utils"

interface FormRowProps {
  children: React.ReactNode
  className?: string
}

/**
 * Horizontal layout for placing multiple form fields side by side.
 */
export function FormRow({ children, className }: FormRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:gap-3 [&>*]:flex-1",
        className,
      )}
    >
      {children}
    </div>
  )
}
