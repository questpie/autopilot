import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const WIZARD_TOTAL_STEPS = 3

export type WizardStep = 1 | 2 | 3
export interface WizardAccountData {
	name: string
	email: string
}

export interface WizardState {
	currentStep: WizardStep
	completedSteps: WizardStep[]
	/** Data from step 1 */
	accountData: WizardAccountData | null
	/** Provider choice from step 3 (always openrouter in v3) */
	providerChoice: 'openrouter' | null
	handoffReady: boolean
	hasHydrated: boolean
}

interface WizardActions {
	setHasHydrated: (hydrated: boolean) => void
	setStep: (step: WizardStep) => void
	completeStep: (step: WizardStep) => void
	nextStep: () => void
	prevStep: () => void
	setAccountData: (data: WizardAccountData) => void
	setProviderChoice: (choice: 'openrouter') => void
	setHandoffReady: (ready: boolean) => void
	reset: () => void
	isStepComplete: (step: WizardStep) => boolean
}

type PersistedWizardState = Pick<
	WizardState,
	'accountData' | 'completedSteps' | 'currentStep' | 'handoffReady' | 'providerChoice'
>

const initialWizardState: PersistedWizardState = {
	currentStep: 1,
	completedSteps: [],
	accountData: null,
	providerChoice: null,
	handoffReady: false,
}

export const useWizardState = create<WizardState & WizardActions>()(
	persist(
		(set, get) => ({
			...initialWizardState,
			hasHydrated: false,

			setHasHydrated: (hasHydrated) => set({ hasHydrated }),

			setStep: (step) => set({ currentStep: step }),

			completeStep: (step) =>
				set((state) => ({
					completedSteps: state.completedSteps.includes(step)
						? state.completedSteps
						: [...state.completedSteps, step],
				})),

			nextStep: () =>
				set((state) => {
					const next = Math.min(state.currentStep + 1, WIZARD_TOTAL_STEPS) as WizardStep
					return { currentStep: next }
				}),

			prevStep: () =>
				set((state) => {
					const prev = Math.max(state.currentStep - 1, 1) as WizardStep
					return { currentStep: prev }
				}),

			setAccountData: (accountData) => set({ accountData }),
			setProviderChoice: (providerChoice) => set({ providerChoice }),
			setHandoffReady: (handoffReady) => set({ handoffReady }),

			reset: () =>
				set((state) => ({
					...initialWizardState,
					hasHydrated: state.hasHydrated,
				})),

			isStepComplete: (step) => get().completedSteps.includes(step),
		}),
		{
			name: 'questpie-setup-wizard',
			storage: createJSONStorage(() => sessionStorage),
			skipHydration: true,
			partialize: (state): PersistedWizardState => ({
				currentStep: state.currentStep,
				completedSteps: state.completedSteps,
				accountData: state.accountData,
				providerChoice: state.providerChoice,
				handoffReady: state.handoffReady,
			}),
		},
	),
)
