import { cn } from "@/lib/utils"

interface FormSectionProps {
  title: React.ReactNode
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Titled group for organizing form fields into logical sections.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <fieldset className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <legend className="font-heading text-sm font-semibold">
          {title}
        </legend>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </fieldset>
  )
}
