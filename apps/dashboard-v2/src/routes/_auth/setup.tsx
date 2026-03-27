import { createFileRoute } from "@tanstack/react-router"
import { useWizardState, WIZARD_TOTAL_STEPS, type WizardStep } from "@/features/setup/use-wizard-state"
import { WizardProgress } from "@/features/setup/wizard-progress"
import { WizardStep1 } from "@/features/setup/wizard-step-1"
import { WizardStep2 } from "@/features/setup/wizard-step-2"
import { WizardStep3 } from "@/features/setup/wizard-step-3"
import { WizardStep4 } from "@/features/setup/wizard-step-4"
import { WizardStep5 } from "@/features/setup/wizard-step-5"
import { WizardStep6 } from "@/features/setup/wizard-step-6"
import { WizardStep7 } from "@/features/setup/wizard-step-7"
import { WizardStep8 } from "@/features/setup/wizard-step-8"
import { WizardStep9 } from "@/features/setup/wizard-step-9"
import { WizardDone } from "@/features/setup/wizard-done"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useState } from "react"

export const Route = createFileRoute("/_auth/setup")({
  component: SetupPage,
})

function SetupPage() {
  const { currentStep, nextStep, prevStep } = useWizardState()
  const [showDone, setShowDone] = useState(false)

  const handleNext = useCallback(() => {
    if (currentStep === WIZARD_TOTAL_STEPS) {
      setShowDone(true)
    } else {
      nextStep()
    }
  }, [currentStep, nextStep])

  const handleSkip = useCallback(() => {
    if (currentStep === WIZARD_TOTAL_STEPS) {
      setShowDone(true)
    } else {
      nextStep()
    }
  }, [currentStep, nextStep])

  const handleBack = useCallback(() => {
    prevStep()
  }, [prevStep])

  const handleFinish = useCallback(() => {
    // Clear wizard state -- done in WizardDone component
  }, [])

  if (showDone) {
    return (
      <div className="flex flex-col">
        <WizardProgress />
        <WizardDone onFinish={handleFinish} />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Step counter */}
      <div className="mb-2 text-center">
        <span className="font-heading text-xs text-muted-foreground">
          {currentStep}/{WIZARD_TOTAL_STEPS}
        </span>
      </div>

      <WizardProgress />

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <StepContent
            step={currentStep}
            onComplete={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StepContent({
  step,
  onComplete,
  onBack,
  onSkip,
}: {
  step: WizardStep
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}) {
  switch (step) {
    case 1:
      return <WizardStep1 onComplete={onComplete} />
    case 2:
      return <WizardStep2 onComplete={onComplete} onBack={onBack} />
    case 3:
      return <WizardStep3 onComplete={onComplete} onBack={onBack} />
    case 4:
      return <WizardStep4 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    case 5:
      return <WizardStep5 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    case 6:
      return <WizardStep6 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    case 7:
      return <WizardStep7 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    case 8:
      return <WizardStep8 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    case 9:
      return <WizardStep9 onComplete={onComplete} onBack={onBack} onSkip={onSkip} />
    default:
      return null
  }
}
