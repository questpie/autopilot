import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SurfaceSection } from '@/components/ui/surface-section'
import { Textarea } from '@/components/ui/textarea'
import { useConfigRecords } from '@/hooks/use-config'
import { Bot, BrainCircuit, PlugZap, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

interface AgentSetupWizardProps {
	value: string
	onChange: (value: string) => void
	draftId: string
	onDraftIdChange: (value: string) => void
	/** When set, the wizard pulls capability profiles for that project too. */
	projectId?: string | null
}

interface AgentDraft {
	id: string
	name: string
	role: string
	description: string
	provider: string
	model: string
	variant: string
	capabilityProfiles: string
}

const ROLE_OPTIONS = [
	{ value: 'developer', label: 'Developer' },
	{ value: 'reviewer', label: 'Reviewer' },
	{ value: 'planner', label: 'Planner' },
	{ value: 'researcher', label: 'Researcher' },
	{ value: 'operator', label: 'Operator' },
]

const PROVIDER_OPTIONS = [
	{ value: '', label: 'Provider default' },
	{ value: 'anthropic', label: 'Anthropic' },
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'google', label: 'Google' },
	{ value: 'local', label: 'Local' },
]

const VARIANT_OPTIONS = [
	{ value: '', label: 'Default behavior' },
	{ value: 'extended-thinking', label: 'Extended thinking' },
	{ value: 'fast', label: 'Fast path' },
	{ value: 'review', label: 'Review focused' },
]

function toAgentId(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function parseAgent(value: string, fallbackId: string): AgentDraft {
	try {
		const raw = JSON.parse(value) as Record<string, unknown>
		return {
			id: typeof raw.id === 'string' ? raw.id : fallbackId,
			name: typeof raw.name === 'string' ? raw.name : '',
			role: typeof raw.role === 'string' ? raw.role : 'developer',
			description: typeof raw.description === 'string' ? raw.description : '',
			provider: typeof raw.provider === 'string' ? raw.provider : '',
			model: typeof raw.model === 'string' ? raw.model : '',
			variant: typeof raw.variant === 'string' ? raw.variant : '',
			capabilityProfiles: Array.isArray(raw.capability_profiles)
				? raw.capability_profiles.filter((item): item is string => typeof item === 'string').join(', ')
				: '',
		}
	} catch {
		return {
			id: fallbackId,
			name: '',
			role: 'developer',
			description: '',
			provider: '',
			model: '',
			variant: '',
			capabilityProfiles: '',
		}
	}
}

function serializeAgent(draft: AgentDraft): string {
	const capabilityProfiles = draft.capabilityProfiles
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)

	const record: Record<string, unknown> = {
		id: draft.id,
		name: draft.name,
		role: draft.role,
		description: draft.description,
		capability_profiles: capabilityProfiles,
	}

	if (draft.provider) record.provider = draft.provider
	if (draft.model) record.model = draft.model
	if (draft.variant) record.variant = draft.variant

	return JSON.stringify(record, null, 2)
}

function Field({
	label,
	children,
	description,
}: {
	label: string
	children: ReactNode
	description?: string
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
			{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
		</div>
	)
}

export function AgentSetupWizard({
	value,
	onChange,
	draftId,
	onDraftIdChange,
	projectId = null,
}: AgentSetupWizardProps) {
	// Pull capability profiles + workflows so the wizard can:
	// - offer a real picker instead of comma-only freeform input
	// - warn when a referenced profile doesn't exist
	// - show which workflows reference this agent
	const companyCapsQuery = useConfigRecords('capabilities', null)
	const projectCapsQuery = useConfigRecords('capabilities', projectId)
	const companyWorkflowsQuery = useConfigRecords('workflows', null)
	const projectWorkflowsQuery = useConfigRecords('workflows', projectId)

	const availableCapabilityIds = useMemo(() => {
		const set = new Set<string>()
		for (const list of [companyCapsQuery.data ?? [], projectCapsQuery.data ?? []]) {
			for (const record of list) {
				const r = record as { id?: string }
				if (r.id) set.add(r.id)
			}
		}
		return [...set].sort()
	}, [companyCapsQuery.data, projectCapsQuery.data])

	const parsed = useMemo(() => parseAgent(value, draftId), [draftId, value])
	const [draft, setDraft] = useState(parsed)

	useEffect(() => {
		setDraft(parsed)
	}, [parsed])

	function update(patch: Partial<AgentDraft>) {
		const next = { ...draft, ...patch }
		setDraft(next)
		onDraftIdChange(next.id)
		onChange(serializeAgent(next))
	}

	function updateName(name: string) {
		const nextId = draft.id ? draft.id : toAgentId(name)
		update({ name, id: nextId })
	}

	const selectedCapabilities = draft.capabilityProfiles
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)

	const capabilityCount = selectedCapabilities.length

	function toggleCapability(id: string) {
		const set = new Set(selectedCapabilities)
		if (set.has(id)) set.delete(id)
		else set.add(id)
		update({ capabilityProfiles: [...set].join(', ') })
	}

	const missingCapabilities = selectedCapabilities.filter(
		(id) => !availableCapabilityIds.includes(id),
	)

	const referencingWorkflows = useMemo(() => {
		const matches = new Set<string>()
		const pools = [companyWorkflowsQuery.data ?? [], projectWorkflowsQuery.data ?? []]
		for (const list of pools) {
			for (const record of list) {
				const r = record as { id?: string; name?: string; steps?: unknown }
				if (!r.id || !Array.isArray(r.steps)) continue
				for (const step of r.steps) {
					if (
						step &&
						typeof step === 'object' &&
						(step as { agent_id?: string }).agent_id === draft.id
					) {
						matches.add(r.id)
						break
					}
				}
			}
		}
		return [...matches]
	}, [companyWorkflowsQuery.data, draft.id, projectWorkflowsQuery.data])

	return (
		<div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
			<div className="grid gap-4 md:grid-cols-2">
				<Field label="Agent ID" description="Lowercase stable ID used by tasks, workflows, and MCP tools.">
					<Input
						aria-label="Agent ID"
						value={draft.id}
						onChange={(event) => update({ id: toAgentId(event.target.value) })}
						placeholder="developer"
						autoComplete="off"
					/>
				</Field>

				<Field label="Display name">
					<Input
						aria-label="Display name"
						value={draft.name}
						onChange={(event) => updateName(event.target.value)}
						placeholder="Developer"
						autoComplete="off"
					/>
				</Field>

				<Field label="Role">
					<Select
						aria-label="Role"
						value={draft.role}
						onChange={(event) => update({ role: event.target.value })}
					>
						{ROLE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</Field>

				<Field label="Provider hint">
					<Select
						aria-label="Provider hint"
						value={draft.provider}
						onChange={(event) => update({ provider: event.target.value })}
					>
						{PROVIDER_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</Field>

				<Field label="Model hint">
					<Input
						aria-label="Model hint"
						value={draft.model}
						onChange={(event) => update({ model: event.target.value })}
						placeholder="claude-opus-4-6, gpt-5.2, ..."
						autoComplete="off"
					/>
				</Field>

				<Field label="Variant">
					<Select
						aria-label="Variant"
						value={draft.variant}
						onChange={(event) => update({ variant: event.target.value })}
					>
						{VARIANT_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</Field>

				<div className="md:col-span-2 space-y-2">
					<Field label="Capability profiles" description="Profile IDs resolved into skills, MCP servers, context, prompts, and runtime hints. Click a chip to toggle.">
						<Input
							aria-label="Capability profiles"
							value={draft.capabilityProfiles}
							onChange={(event) => update({ capabilityProfiles: event.target.value })}
							placeholder="coding, review, browser-testing"
							autoComplete="off"
						/>
					</Field>
					{availableCapabilityIds.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{availableCapabilityIds.map((id) => {
								const active = selectedCapabilities.includes(id)
								return (
									<button
										key={id}
										type="button"
										onClick={() => toggleCapability(id)}
										className="cursor-pointer"
										aria-label={`Toggle capability ${id}`}
									>
										<Badge variant={active ? 'info' : 'outline'} className="font-mono">
											{id}
										</Badge>
									</button>
								)
							})}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">
							No capability profiles defined yet. Create one in the Capabilities tab.
						</p>
					)}
					{missingCapabilities.length > 0 ? (
						<p className="text-xs text-amber-500">
							Unknown profiles will not resolve at runtime: {missingCapabilities.join(', ')}.
						</p>
					) : null}
				</div>

				<div className="md:col-span-2">
					<Field label="Operating brief">
						<Textarea
							aria-label="Operating brief"
							value={draft.description}
							onChange={(event) => update({ description: event.target.value })}
							placeholder="What this agent owns, when to use it, and what it should optimize for."
							className="min-h-28 resize-y"
						/>
					</Field>
				</div>
			</div>

			<SurfaceSection
				title="Runtime profile"
				description="This is the DB config that chat, tasks, schedules, workflows, and workers resolve at runtime."
				contentClassName="space-y-3"
			>
				<div className="flex items-center gap-2">
					<Bot className="size-4 text-primary" />
					<span className="text-sm font-medium text-foreground">{draft.name || 'Unnamed agent'}</span>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge variant="info">{draft.role || 'developer'}</Badge>
					{draft.provider ? <Badge variant="outline">{draft.provider}</Badge> : null}
					{draft.model ? <Badge variant="outline">{draft.model}</Badge> : null}
					{draft.variant ? <Badge variant="outline">{draft.variant}</Badge> : null}
				</div>
				<div className="grid gap-2 pt-2 text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<Workflow className="size-3.5" />
						<span>Available as workflow agent_id `{draft.id || 'agent-id'}`.</span>
					</div>
					<div className="flex items-center gap-2">
						<PlugZap className="size-3.5" />
						<span>Worker execution goes through spawn-agent + Autopilot MCP.</span>
					</div>
					<div className="flex items-center gap-2">
						<BrainCircuit className="size-3.5" />
						<span>{capabilityCount} capability profile{capabilityCount === 1 ? '' : 's'} attached.</span>
					</div>
					{referencingWorkflows.length > 0 ? (
						<div className="space-y-1">
							<div>Referenced by:</div>
							<div className="flex flex-wrap gap-1">
								{referencingWorkflows.map((id) => (
									<Badge key={id} variant="outline" className="font-mono">
										{id}
									</Badge>
								))}
							</div>
						</div>
					) : null}
				</div>
			</SurfaceSection>
		</div>
	)
}
