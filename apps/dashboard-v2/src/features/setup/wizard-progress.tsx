import { cn } from "@/lib/utils"
import { useWizardState, WIZARD_TOTAL_STEPS, type WizardStep } from "./use-wizard-state"

/**
 * Progress dots for the setup wizard.
 * Active = primary, Done = success, Skipped = muted, Pending = border.
 */
export function WizardProgress() {
  const { currentStep, isStepComplete, isStepSkipped } = useWizardState()

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, i) => {
        const step = (i + 1) as WizardStep
        const isActive = step === currentStep
        const isDone = isStepComplete(step) && !isActive
        const isSkip = isStepSkipped(step) && !isActive

        return (
          <div
            key={step}
            className={cn(
              "size-2 transition-colors",
              isActive && "bg-primary",
              isDone && !isSkip && "bg-success",
              isSkip && "bg-muted-foreground/40",
              !isActive && !isDone && !isSkip && "bg-border",
            )}
            aria-label={`Step ${step}${isActive ? " (current)" : ""}${isDone ? " (complete)" : ""}${isSkip ? " (skipped)" : ""}`}
          />
        )
      })}
    </div>
  )
}
