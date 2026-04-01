import { cn } from "@/lib/utils"
import { useWizardState, WIZARD_TOTAL_STEPS, type WizardStep } from "./use-wizard-state"

/**
 * Progress dots for the setup wizard.
 * Active = primary, Done = success, Pending = border.
 */
export function WizardProgress() {
  const { currentStep, isStepComplete } = useWizardState()

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, i) => {
        const step = (i + 1) as WizardStep
        const isActive = step === currentStep
        const isDone = isStepComplete(step) && !isActive

        return (
          <div
            key={step}
            className={cn(
              "size-2 transition-colors",
              isActive && "bg-primary",
              isDone && "bg-success",
              !isActive && !isDone && "bg-border",
            )}
            aria-label={`Step ${step}${isActive ? " (current)" : ""}${isDone ? " (complete)" : ""}`}
          />
        )
      })}
    </div>
  )
}
