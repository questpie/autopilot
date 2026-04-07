import type { ReactNode } from "react"

interface WizardStepLayoutProps {
  /** Heading + description */
  header: ReactNode
  /** Main content — centered */
  children: ReactNode
  /** Action buttons */
  footer: ReactNode
}

/**
 * 3-zone layout for wizard steps:
 * - Header (centered)
 * - Main content (centered)
 * - Footer (actions)
 *
 * The entire block is vertically centered by the auth layout's my-auto.
 */
export function WizardStepLayout({ header, children, footer }: WizardStepLayoutProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="text-center">{header}</div>

      {/* Content */}
      <div className="flex flex-col items-center gap-6 py-4">
        {children}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4">{footer}</div>
    </div>
  )
}
