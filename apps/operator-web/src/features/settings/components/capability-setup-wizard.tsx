/**
 * Capability profile wizard.
 *
 * Capability profiles are the answer to "why did this agent get this tool/
 * context?" — they bundle skills, MCP server references, context files, and
 * prompt fragments under a stable ID that agents and workflow steps reference.
 *
 * Skills and context are picked from existing catalog records (with the
 * default skill catalog as a sensible starting point). MCP server IDs are
 * freeform until the MCP server registry has a first-class config table —
 * we explicitly mark this in the UI rather than pretend there is one.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SurfaceSection } from '@/components/ui/surface-section'
import { Textarea } from '@/components/ui/textarea'
import { useConfigRecords, useDefaultSkillCatalog } from '@/hooks/use-config'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface CapabilityWizardProps {
	value: string
	onChange: (next: string) => void
	draftId: string
	onDraftIdChange: (next: string) => void
	projectId: string | null
}

interface CapabilityDraft {
	id: string
	description: string
	skills: string[]
	mcp_servers: string[]
	context: string[]
	prompts: string[]
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === 'string')
}

function parseDraft(value: string, fallbackId: string): CapabilityDraft {
	if (!value.trim()) {
		return {
			id: fallbackId,
			description: '',
			skills: [],
			mcp_servers: [],
			context: [],
			prompts: [],
		}
	}
	try {
		const raw = JSON.parse(value) as Record<string, unknown>
		return {
			id: asString(raw.id) ?? fallbackId,
			description: asString(raw.description) ?? '',
			skills: asStringArray(raw.skills),
			mcp_servers: asStringArray(raw.mcp_servers),
			context: asStringArray(raw.context),
			prompts: asStringArray(raw.prompts),
		}
	} catch {
		return {
			id: fallbackId,
			description: '',
			skills: [],
			mcp_servers: [],
			context: [],
			prompts: [],
		}
	}
}

function serializeDraft(draft: CapabilityDraft): string {
	return JSON.stringify(
		{
			id: draft.id,
			description: draft.description,
			skills: draft.skills,
			mcp_servers: draft.mcp_servers,
			context: draft.context,
			prompts: draft.prompts,
		},
		null,
		2,
	)
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

interface ChipPickerProps {
	label: string
	hint?: string
	values: string[]
	available: { id: string; subtitle?: string }[]
	onChange: (next: string[]) => void
	addPlaceholder?: string
	allowCustom?: boolean
}

function ChipPicker({
	label,
	hint,
	values,
	available,
	onChange,
	addPlaceholder,
	allowCustom = true,
}: ChipPickerProps) {
	const [draft, setDraft] = useState('')

	function add(id: string) {
		const trimmed = id.trim()
		if (!trimmed) return
		if (values.includes(trimmed)) return
		onChange([...values, trimmed])
		setDraft('')
	}

	function remove(id: string) {
		onChange(values.filter((v) => v !== id))
	}

	const remaining = available.filter((opt) => !values.includes(opt.id))

	return (
		<div className="space-y-2">
			<div>
				<Label>{label}</Label>
				{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
			</div>

			{values.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{values.map((id) => (
						<Badge key={id} variant="info" className="gap-1.5">
							<span className="font-mono">{id}</span>
							<button
								type="button"
								aria-label={`Remove ${id}`}
								onClick={() => remove(id)}
								className="text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			) : null}

			<div className="flex gap-2">
				<Input
					aria-label={`Add ${label}`}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault()
							add(draft)
						}
					}}
					placeholder={addPlaceholder ?? `Add ${label.toLowerCase()}`}
					list={`${label.replace(/\s+/g, '-')}-options`}
				/>
				<Button type="button" size="sm" variant="outline" onClick={() => add(draft)}>
					<Plus className="size-3.5" />
					Add
				</Button>
			</div>

			{remaining.length > 0 && (
				<datalist id={`${label.replace(/\s+/g, '-')}-options`}>
					{remaining.map((opt) => (
						<option key={opt.id} value={opt.id}>
							{opt.subtitle ?? ''}
						</option>
					))}
				</datalist>
			)}

			{remaining.length > 0 && allowCustom === false && values.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					Available: {remaining.map((o) => o.id).join(', ')}
				</p>
			) : null}
		</div>
	)
}

export function CapabilitySetupWizard({
	value,
	onChange,
	draftId,
	onDraftIdChange,
	projectId,
}: CapabilityWizardProps) {
	const skillsQuery = useConfigRecords('skills', projectId)
	const companySkillsQuery = useConfigRecords('skills', null)
	const defaultSkillsQuery = useDefaultSkillCatalog()
	const contextQuery = useConfigRecords('context', projectId)
	const companyContextQuery = useConfigRecords('context', null)
	const [skillSearch, setSkillSearch] = useState('')

	const availableSkills = useMemo(() => {
		const defaultById = new Map(
			(defaultSkillsQuery.data ?? []).map((skill) => [skill.id, skill]),
		)
		const merged = new Map<
			string,
			{ id: string; subtitle?: string; availability?: 'built_in' | 'plugin_backed' | 'custom' }
		>()
		for (const list of [companySkillsQuery.data ?? [], skillsQuery.data ?? []]) {
			for (const record of list) {
				const r = record as { id?: string; manifest?: { description?: string } }
				if (r.id) {
					merged.set(r.id, {
						id: r.id,
						subtitle: r.manifest?.description,
						availability: defaultById.get(r.id)?.availability ?? 'custom',
					})
				}
			}
		}
		for (const skill of defaultSkillsQuery.data ?? []) {
			if (merged.has(skill.id)) continue
			merged.set(skill.id, {
				id: skill.id,
				subtitle: skill.description,
				availability: skill.availability,
			})
		}
		return [...merged.values()]
	}, [companySkillsQuery.data, defaultSkillsQuery.data, skillsQuery.data])

	const filteredSkills = useMemo(() => {
		const query = skillSearch.trim().toLowerCase()
		if (!query) return availableSkills
		return availableSkills.filter((skill) =>
			[skill.id, skill.subtitle, skill.availability]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query)),
		)
	}, [availableSkills, skillSearch])

	const availableContext = useMemo(() => {
		const merged = new Map<string, { id: string }>()
		for (const list of [companyContextQuery.data ?? [], contextQuery.data ?? []]) {
			for (const record of list) {
				const r = record as { id?: string }
				if (r.id) merged.set(r.id, { id: r.id })
			}
		}
		return [...merged.values()]
	}, [companyContextQuery.data, contextQuery.data])

	const parsed = useMemo(() => parseDraft(value, draftId), [draftId, value])
	const [draft, setDraft] = useState<CapabilityDraft>(parsed)

	useEffect(() => {
		setDraft(parsed)
	}, [parsed])

	function applyChange(next: CapabilityDraft) {
		setDraft(next)
		onDraftIdChange(next.id)
		onChange(serializeDraft(next))
	}

	function update(patch: Partial<CapabilityDraft>) {
		applyChange({ ...draft, ...patch })
	}

	function setPrompt(index: number, value: string) {
		const prompts = [...draft.prompts]
		prompts[index] = value
		update({ prompts })
	}

	function addPrompt() {
		update({ prompts: [...draft.prompts, ''] })
	}

	function removePrompt(index: number) {
		update({ prompts: draft.prompts.filter((_, i) => i !== index) })
	}

	const unknownSkills = draft.skills.filter(
		(id) => !availableSkills.some((skill) => skill.id === id),
	)

	return (
		<div className="space-y-4">
			<SurfaceSection
				title="Capability profile"
				description="A profile bundles skills, MCP server references, context files, and prompt fragments. Agents and workflow steps attach profiles by ID."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1">
						<Label>Profile ID</Label>
						<Input
							aria-label="Profile ID"
							value={draft.id}
							onChange={(e) => update({ id: toSlug(e.target.value) })}
							placeholder="coding"
						/>
					</div>
					<div className="space-y-1">
						<Label>Description</Label>
						<Input
							aria-label="Profile description"
							value={draft.description}
							onChange={(e) => update({ description: e.target.value })}
							placeholder="Local coding agent runtime."
						/>
					</div>
				</div>
			</SurfaceSection>

			<div className="grid gap-4 lg:grid-cols-2">
				<SurfaceSection
					title="Skills"
					description="Skill IDs from the catalog. The default catalog contains skill-creator, skill-installer, knowledge-authoring, project-run-review and more."
					contentClassName="space-y-2"
				>
					<Input
						aria-label="Search skill catalog"
						value={skillSearch}
						onChange={(e) => setSkillSearch(e.target.value)}
						placeholder="Search skill catalog"
					/>
					<ChipPicker
						label="Active skills"
						values={draft.skills}
						available={filteredSkills}
						onChange={(next) => update({ skills: next })}
						addPlaceholder="skill-id (Enter to add)"
					/>
					{filteredSkills.length > 0 ? (
						<div className="grid gap-1.5">
							{filteredSkills.slice(0, 8).map((skill) => (
								<div
									key={skill.id}
									className="flex items-start justify-between gap-3 rounded-md border border-border/50 px-2.5 py-2"
								>
									<div className="min-w-0">
										<p className="truncate font-mono text-xs text-foreground">{skill.id}</p>
										{skill.subtitle ? (
											<p className="line-clamp-2 text-xs text-muted-foreground">
												{skill.subtitle}
											</p>
										) : null}
									</div>
									<Badge
										variant={skill.availability === 'plugin_backed' ? 'warning' : 'outline'}
										className="shrink-0"
									>
										{skill.availability ?? 'custom'}
									</Badge>
								</div>
							))}
						</div>
					) : null}
					{unknownSkills.length > 0 && (
						<p className="text-xs text-amber-500">
							Unknown skills: {unknownSkills.join(', ')}. They will not resolve at runtime.
						</p>
					)}
				</SurfaceSection>

				<SurfaceSection
					title="MCP servers"
					description="MCP server IDs to include in the runtime MCP config. MCP servers are not yet a first-class config record — IDs are freeform until they are."
					contentClassName="space-y-2"
				>
					<ChipPicker
						label="Active MCP servers"
						values={draft.mcp_servers}
						available={[]}
						onChange={(next) => update({ mcp_servers: next })}
						addPlaceholder="autopilot, github, ... (Enter to add)"
					/>
				</SurfaceSection>

				<SurfaceSection
					title="Context"
					description="Context files (from .autopilot/context/) injected for runs that activate this profile."
					contentClassName="space-y-2"
				>
					{availableContext.length === 0 ? (
						<EmptyState
							icon={Sparkles}
							title="No context files yet"
							description="Add context files in the Context tab to attach them here."
							height="h-32"
						/>
					) : (
						<ChipPicker
							label="Active context"
							values={draft.context}
							available={availableContext.map((c) => ({ id: c.id }))}
							onChange={(next) => update({ context: next })}
							addPlaceholder="context-id (Enter to add)"
						/>
					)}
				</SurfaceSection>

				<SurfaceSection
					title="Prompt fragments"
					description="Short fragments injected into the run instructions. Use sparingly — keep always-loaded prompts under a couple of paragraphs total."
					action={
						<Button type="button" size="sm" variant="outline" onClick={addPrompt}>
							<Plus className="size-3.5" />
							Add fragment
						</Button>
					}
					contentClassName="space-y-2"
				>
					{draft.prompts.length === 0 ? (
						<p className="text-sm text-muted-foreground">No fragments. Add one if needed.</p>
					) : (
						draft.prompts.map((prompt, index) => (
							<div key={index} className="flex gap-2">
								<Textarea
									aria-label={`Prompt fragment ${index + 1}`}
									value={prompt}
									onChange={(e) => setPrompt(index, e.target.value)}
									placeholder="When working on the marketing site, prefer voice-and-tone reviewer over generic reviewer."
									className="min-h-20 flex-1 resize-y"
								/>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									aria-label={`Remove fragment ${index + 1}`}
									onClick={() => removePrompt(index)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						))
					)}
				</SurfaceSection>
			</div>

			<SurfaceSection
				title="Resolved preview"
				description="What workers receive when an agent activates this profile."
				contentClassName="space-y-2"
			>
				<div className="text-xs text-muted-foreground tabular-nums">
					skills:{' '}
					{draft.skills.length === 0
						? '—'
						: draft.skills.map((id) => (
								<Badge key={id} variant="outline" className="ml-1 font-mono">
									{id}
								</Badge>
							))}
				</div>
				<div className="text-xs text-muted-foreground tabular-nums">
					mcp:{' '}
					{draft.mcp_servers.length === 0
						? '—'
						: draft.mcp_servers.map((id) => (
								<Badge key={id} variant="outline" className="ml-1 font-mono">
									{id}
								</Badge>
							))}
				</div>
				<div className="text-xs text-muted-foreground tabular-nums">
					context:{' '}
					{draft.context.length === 0
						? '—'
						: draft.context.map((id) => (
								<Badge key={id} variant="outline" className="ml-1 font-mono">
									{id}
								</Badge>
							))}
				</div>
				<div className="text-xs text-muted-foreground tabular-nums">
					prompts: {draft.prompts.filter(Boolean).length}
				</div>
			</SurfaceSection>
		</div>
	)
}
