import { useMemo, useState } from 'react'
import { GenerativeAvatar } from '@questpie/avatar'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModelPicker } from '@/components/model-picker'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import type { WizardAccountData } from './use-wizard-state'
import { useWizardState } from './use-wizard-state'

interface SetupHandoffProps {
	fallbackOwner?: WizardAccountData | null
	onBack?: () => void
}

function yamlString(value: string): string {
	return JSON.stringify(value)
}

function buildCeoAgentYaml(name: string, model: string): string {
	return [
		'id: ceo',
		`name: ${yamlString(name)}`,
		'role: meta',
		`description: ${yamlString(
			"Your company's AI manager. Handles onboarding, team coordination, and strategic decisions.",
		)}`,
		'provider: tanstack-ai',
		`model: ${yamlString(model)}`,
		'web_search: false',
		'fs_scope:',
		'  read:',
		'    - /**',
		'  write:',
		'    - /**',
		'tools:',
		'  - fs',
		'  - terminal',
		'mcps: []',
		'triggers: []',
	].join('\n')
}

export function SetupHandoff({
	fallbackOwner = null,
	onBack,
}: SetupHandoffProps): React.JSX.Element {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { accountData, reset } = useWizardState()
	const owner = fallbackOwner ?? accountData
	const [agentName, setAgentName] = useState('Atlas')
	const [model, setModel] = useState('anthropic/claude-sonnet-4')

	const ownerLabel = useMemo(() => {
		if (!owner) return 'your workspace'
		return `${owner.name} (${owner.email})`
	}, [owner])

	const createWorkspace = useMutation({
		mutationFn: async () => {
			const fileResponse = await api.api.files[':path{.+}'].$put({
				param: { path: 'team/agents/ceo.yaml' },
				json: { content: buildCeoAgentYaml(agentName.trim() || 'Atlas', model) },
			})
			if (!fileResponse.ok) {
				const body = await fileResponse.json().catch(() => ({}))
				throw new Error((body as { error?: string }).error ?? 'Failed to save CEO agent')
			}

			const setupResponse = await api.api.setup.complete.$post()
			if (!setupResponse.ok) {
				const body = await setupResponse.json().catch(() => ({}))
				throw new Error((body as { error?: string }).error ?? 'Failed to finalize setup')
			}

			const sessionResponse = await api.api['chat-sessions'].$post({
				json: {
					agentId: 'ceo',
					message: '__onboarding__',
				},
			})
			if (!sessionResponse.ok) {
				const body = await sessionResponse.json().catch(() => ({}))
				throw new Error((body as { error?: string }).error ?? 'Failed to start onboarding session')
			}

			return sessionResponse.json()
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Failed to create your CEO agent')
		},
		onSuccess: async (session) => {
			reset()
			await navigate({
				to: '/s/$sessionId',
				params: { sessionId: session.sessionId },
			})
		},
	})

	return (
		<div className="flex flex-col gap-6">
			<div className="space-y-2 text-center">
				<h2 className="font-heading text-xl font-semibold">Create your first agent</h2>
				<p className="text-sm text-muted-foreground">
					This will be your company&apos;s AI manager and the first chat you open after setup.
				</p>
			</div>

			<div className="flex flex-col items-center gap-4 border border-border p-6">
				<GenerativeAvatar
					seed={agentName || 'Atlas'}
					size={80}
					className="size-20 border border-border"
				/>
				<div className="w-full max-w-md space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="ceo-name" className="font-heading text-xs">
							Agent name
						</Label>
						<Input
							id="ceo-name"
							value={agentName}
							onChange={(event) => setAgentName(event.target.value)}
							placeholder="Atlas"
							disabled={createWorkspace.isPending}
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="font-heading text-xs">Model</Label>
						<ModelPicker
							value={model}
							onValueChange={setModel}
							className="w-full"
						/>
					</div>
				</div>
			</div>

			<div className="border border-border p-4 text-sm text-muted-foreground">
				<div className="font-heading text-xs uppercase tracking-widest text-foreground">
					Setup summary
				</div>
				<div className="mt-2">Workspace owner: {ownerLabel}</div>
				<div className="mt-1">Provider: OpenRouter</div>
			</div>

			<div className="flex gap-2">
				{onBack ? (
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={onBack}
						disabled={createWorkspace.isPending}
					>
						<ArrowLeftIcon className="size-4" />
						{t('common.back')}
					</Button>
				) : null}
				<Button
					type="button"
					size="lg"
					className="flex-1"
					onClick={() => void createWorkspace.mutateAsync()}
					loading={createWorkspace.isPending}
				>
					Create &amp; Start
					<ArrowRightIcon className="size-4" />
				</Button>
			</div>
		</div>
	)
}
