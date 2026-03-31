import { create } from 'zustand'

export const WIZARD_TOTAL_STEPS = 3
export const WIZARD_MANDATORY_STEPS = 3

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface WizardState {
	currentStep: WizardStep
	completedSteps: Set<WizardStep>
	skippedSteps: Set<WizardStep>
	/** Data from step 1 */
	accountData: {
		name: string
		email: string
	} | null
	/** Provider choice from step 3 (always openrouter in v3) */
	providerChoice: 'openrouter' | null
	/** Reserved for legacy optional setup steps; retained for state compatibility. */
	teamTemplate: 'solo' | 'minimal' | 'custom' | null
}

interface WizardActions {
	setStep: (step: WizardStep) => void
	completeStep: (step: WizardStep) => void
	skipStep: (step: WizardStep) => void
	nextStep: () => void
	prevStep: () => void
	setAccountData: (data: { name: string; email: string }) => void
	setProviderChoice: (choice: 'openrouter') => void
	setTeamTemplate: (template: 'solo' | 'minimal' | 'custom') => void
	reset: () => void
	isStepComplete: (step: WizardStep) => boolean
	isStepSkipped: (step: WizardStep) => boolean
	canSkip: (step: WizardStep) => boolean
}

const initialState: WizardState = {
	currentStep: 1,
	completedSteps: new Set(),
	skippedSteps: new Set(),
	accountData: null,
	providerChoice: null,
	teamTemplate: null,
}

export const useWizardState = create<WizardState & WizardActions>()((set, get) => ({
	...initialState,

	setStep: (step) => set({ currentStep: step }),

	completeStep: (step) =>
		set((state) => ({
			completedSteps: new Set([...state.completedSteps, step]),
		})),

	skipStep: (step) =>
		set((state) => ({
			skippedSteps: new Set([...state.skippedSteps, step]),
			completedSteps: new Set([...state.completedSteps, step]),
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

	setAccountData: (data) => set({ accountData: data }),
	setProviderChoice: (choice) => set({ providerChoice: choice }),
	setTeamTemplate: (template) => set({ teamTemplate: template }),

	reset: () =>
		set({
			...initialState,
			completedSteps: new Set(),
			skippedSteps: new Set(),
		}),

	isStepComplete: (step) => get().completedSteps.has(step),
	isStepSkipped: (step) => get().skippedSteps.has(step),
	canSkip: (step) => step > WIZARD_MANDATORY_STEPS,
}))
