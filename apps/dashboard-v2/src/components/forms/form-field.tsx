import { useFormContext, Controller } from "react-hook-form"
import { m, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  name: string
  label: string
  placeholder?: string
  type?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Form field wrapping an input with label and error display.
 * Integrates with react-hook-form via useFormContext.
 */
export function FormField({
  name,
  label,
  placeholder,
  type = "text",
  className,
  disabled,
  autoFocus,
}: FormFieldProps) {
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
          <input
            {...field}
            id={name}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            className={cn(
              "flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-sm transition-colors",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fieldState.error && "border-destructive",
            )}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${name}-error` : undefined}
          />
          <AnimatePresence>
            {fieldState.error && (
              <m.p
                id={`${name}-error`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-destructive"
              >
                {fieldState.error.message}
              </m.p>
            )}
          </AnimatePresence>
        </div>
      )}
    />
  )
}
