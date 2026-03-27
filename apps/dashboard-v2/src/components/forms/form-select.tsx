import { useFormContext, Controller } from "react-hook-form"
import { cn } from "@/lib/utils"

interface SelectOption {
  value: string
  label: string
}

interface FormSelectProps {
  name: string
  label: string
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Form select wrapping a native select with label and error display.
 * Integrates with react-hook-form via useFormContext.
 */
export function FormSelect({
  name,
  label,
  options,
  placeholder,
  className,
  disabled,
}: FormSelectProps) {
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
          <select
            {...field}
            id={name}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fieldState.error && "border-destructive",
            )}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${name}-error` : undefined}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
