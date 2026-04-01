import {
	WIZARD_TOTAL_STEPS,
	type WizardAccountData,
	type WizardStep,
	useWizardState,
} from '@/features/setup/use-wizard-state'
import { SetupHandoff } from '@/features/setup/setup-handoff'
import { WizardProgress } from '@/features/setup/wizard-progress'
import { WizardStep1 } from '@/features/setup/wizard-step-1'
import { WizardStep2 } from '@/features/setup/wizard-step-2'
import { WizardStep3 } from '@/features/setup/wizard-step-3'
import { checkAuthServer } from '@/lib/auth.fn'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useEffect } from 'react'

export const Route = createFileRoute('/_auth/setup')({
	component: SetupPage,
	beforeLoad: async () => {
		const result = await checkAuthServer()

		if (result.needs2FA) {
			throw redirect({ to: '/login/2fa' })
		}

		// Setup already completed and user is authenticated → go to dashboard
		if (result.isAuthenticated && result.setupCompleted) {
			throw redirect({ to: '/' })
		}

		// Users exist but no session → redirect to login
		if (!result.noUsersExist && !result.isAuthenticated) {
			throw redirect({ to: '/login' })
		}

		return { authResult: result }
	},
})

function SetupPage() {
	const {
		currentStep,
		nextStep,
		prevStep,
		setStep,
		completeStep,
		isStepComplete,
		accountData,
		handoffReady,
		hasHydrated,
		setHasHydrated,
		setAccountData,
		setHandoffReady,
	} = useWizardState()
	const { authResult } = Route.useRouteContext()
	const fallbackOwner: WizardAccountData | null = authResult.user
		? {
				name: authResult.user.name ?? authResult.user.email,
				email: authResult.user.email,
			}
		: null

	useEffect(() => {
		let cancelled = false

		void Promise.resolve(useWizardState.persist.rehydrate()).finally(() => {
			if (!cancelled) {
				setHasHydrated(true)
			}
		})

		return () => {
			cancelled = true
		}
	}, [setHasHydrated])

	// If user is authenticated and wizard is still on step 1, skip to step 2
	useEffect(() => {
		if (!hasHydrated || !authResult.isAuthenticated) {
			return
		}

		if (
			fallbackOwner &&
			(accountData?.email !== fallbackOwner.email || accountData?.name !== fallbackOwner.name)
		) {
			setAccountData(fallbackOwner)
		}

		if (!handoffReady && !isStepComplete(1)) {
			completeStep(1)
		}

		if (!handoffReady && currentStep === 1) {
			setStep(2)
		}
	}, [
		accountData,
		authResult.isAuthenticated,
		completeStep,
		currentStep,
		fallbackOwner,
		hasHydrated,
		handoffReady,
		isStepComplete,
		setAccountData,
		setStep,
	])

	const handleNext = useCallback(() => {
		if (currentStep === WIZARD_TOTAL_STEPS) {
			setHandoffReady(true)
		} else {
			nextStep()
		}
	}, [currentStep, nextStep, setHandoffReady])

	const handleBack = useCallback(() => {
		prevStep()
	}, [prevStep])

	if (!hasHydrated) {
		return <div className="min-h-64" />
	}

	if (handoffReady) {
		return (
			<div className="flex flex-col">
				<WizardProgress />
				<SetupHandoff
					fallbackOwner={fallbackOwner}
					onBack={() => {
						setHandoffReady(false)
						setStep(3)
					}}
				/>
			</div>
		)
	}

	return (
		<div className="flex flex-col">
			{/* Step counter + progress */}
			<div className="mb-6 flex flex-col items-center gap-2">
				<span className="font-heading text-xs text-muted-foreground">
					{currentStep}/{WIZARD_TOTAL_STEPS}
				</span>
				<WizardProgress />
			</div>

			{/* Step content — flex-1 so WizardStepLayout can use full height */}
			<AnimatePresence mode="wait">
				<m.div
					key={currentStep}
					className="flex flex-col"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -20 }}
					transition={{ duration: 0.2 }}
				>
					<StepContent step={currentStep} onComplete={handleNext} onBack={handleBack} />
				</m.div>
			</AnimatePresence>
		</div>
	)
}

function StepContent({
	step,
	onComplete,
	onBack,
}: {
	step: WizardStep
	onComplete: () => void
	onBack: () => void
}) {
	switch (step) {
		case 1:
			return <WizardStep1 onComplete={onComplete} />
		case 2:
			return <WizardStep2 onComplete={onComplete} onBack={onBack} />
		case 3:
			return <WizardStep3 onComplete={onComplete} onBack={onBack} />
		default:
			return null
	}
}
