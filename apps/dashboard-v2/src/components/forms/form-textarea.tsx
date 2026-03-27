import { useFormContext, Controller } from "react-hook-form"
import { cn } from "@/lib/utils"

interface FormTextareaProps {
  name: string
  label: string
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

/**
 * Form textarea wrapping a textarea with label and error display.
 * Integrates with react-hook-form via useFormContext.
 */
export function FormTextarea({
  name,
  label,
  placeholder,
  rows = 3,
  className,
  disabled,
}: FormTextareaProps) {
  const { control } = useFormContext()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("flex flex-col gap-1.5", className)}>
          <label
            htmlFor={name}
            className="font-heading text-xs font-medium text-foreground"
          >
            {label}
          </label>
          <textarea
            {...field}
            id={name}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "resize-y",
              fieldState.error && "border-destructive",
            )}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${name}-error` : undefined}
          />
          {fieldState.error && (
            <p id={`${name}-error`} className="text-xs text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}
