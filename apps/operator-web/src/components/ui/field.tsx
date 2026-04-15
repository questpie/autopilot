import * as React from "react"
import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// ============================================================================
// Field ID Context — links labels, descriptions, and errors to inputs
// ============================================================================

interface FieldIdsContextValue {
  /** Stable base id for generating related ids */
  baseId: string
  /** ID for the description element (aria-describedby target) */
  descriptionId: string
  /** ID for the error element (aria-describedby target) */
  errorId: string
  /** Whether the field currently has an error */
  hasError: boolean
  /** Whether the field currently has a description */
  hasDescription: boolean
  /** Set by FieldDescription when it mounts */
  setHasDescription: (v: boolean) => void
  /** Set by FieldError when it mounts */
  setHasError: (v: boolean) => void
}

const FieldIdsContext = React.createContext<FieldIdsContextValue | null>(null)

/**
 * Hook for input primitives to get `aria-describedby` linking.
 * Returns the composed aria-describedby string pointing to
 * description and/or error elements in the parent Field.
 */
export function useFieldIds() {
  return React.useContext(FieldIdsContext)
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-4",
        className,
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-4",
        className,
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-2",
  {
    variants: {
      orientation: {
        vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto",
        responsive:
          "flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  const baseId = React.useId()
  const [hasDescription, setHasDescription] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)

  const ids = useMemo(
    () => ({
      baseId,
      descriptionId: `${baseId}-desc`,
      errorId: `${baseId}-err`,
      hasDescription,
      hasError,
      setHasDescription,
      setHasError,
    }),
    [baseId, hasDescription, hasError],
  )

  return (
    <FieldIdsContext.Provider value={ids}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    </FieldIdsContext.Provider>
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
        className,
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 font-mono text-xs font-medium leading-snug group-data-[disabled=true]/field:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const fieldIds = React.useContext(FieldIdsContext)

  React.useEffect(() => {
    fieldIds?.setHasDescription(true)
    return () => fieldIds?.setHasDescription(false)
  }, [fieldIds])

  return (
    <p
      id={fieldIds?.descriptionId}
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-left text-xs leading-normal font-normal",
        className,
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-xs",
        className,
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="text-muted-foreground bg-background relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const fieldIds = React.useContext(FieldIdsContext)

  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length === 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error) =>
            error?.message && <li key={error.message}>{error.message}</li>,
        )}
      </ul>
    )
  }, [children, errors])

  React.useEffect(() => {
    fieldIds?.setHasError(!!content)
    return () => fieldIds?.setHasError(false)
  }, [fieldIds, content])

  if (!content) {
    return null
  }

  return (
    <div
      id={fieldIds?.errorId}
      role="alert"
      data-slot="field-error"
      className={cn(
        "text-destructive text-xs font-normal",
        className,
      )}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldContent,
  FieldSet,
  FieldSeparator,
}
