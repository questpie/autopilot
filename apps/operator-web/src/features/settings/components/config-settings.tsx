import type { ConfigEntityType, ContextConfigRecord, ProjectRegistration } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { SurfaceSection } from '@/components/ui/surface-section'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { useAppPreferences } from '@/hooks/use-app-preferences'
import { useConfigRecords, useDeleteConfigRecord, useSaveConfigRecord } from '@/hooks/use-config'
import { useProjects } from '@/hooks/use-projects'
import Editor from '@monaco-editor/react'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type ScopeValue = 'company' | `project:${string}`

interface ConfigTypeOption {
	id: ConfigEntityType
	label: string
	description: string
	singleton?: boolean
	context?: boolean
}

const COMPANY_TYPES: ConfigTypeOption[] = [
	{
		id: 'company',
		label: 'Company',
		description: 'Defaults, queues, commands, and global settings',
		singleton: true,
	},
	{ id: 'agents', label: 'Agents', description: 'Team agent definitions' },
	{ id: 'workflows', label: 'Workflows', description: 'Execution flows and step definitions' },
	{
		id: 'providers',
		label: 'Providers',
		description: 'External channels and integration handlers',
	},
	{ id: 'environments', label: 'Environments', description: 'Runtime tags and secret references' },
	{
		id: 'capabilities',
		label: 'Capabilities',
		description: 'Capability profiles used by steps and agents',
	},
	{ id: 'skills', label: 'Skills', description: 'Installed skill definitions and markdown bodies' },
	{ id: 'scripts', label: 'Scripts', description: 'Standalone script definitions' },
	{ id: 'context', label: 'Context', description: 'Global markdown context files', context: true },
]

const PROJECT_TYPES: ConfigTypeOption[] = [
	{
		id: 'project',
		label: 'Project',
		description: 'Project defaults and overrides',
		singleton: true,
	},
	{ id: 'agents', label: 'Agents', description: 'Project-scoped agent overrides' },
	{ id: 'workflows', label: 'Workflows', description: 'Project workflow overrides' },
	{ id: 'providers', label: 'Providers', description: 'Project-scoped provider overrides' },
	{ id: 'environments', label: 'Environments', description: 'Project environment overrides' },
	{ id: 'capabilities', label: 'Capabilities', description: 'Project capability overrides' },
	{ id: 'skills', label: 'Skills', description: 'Project skill overrides' },
	{ id: 'scripts', label: 'Scripts', description: 'Project script overrides' },
	{ id: 'context', label: 'Context', description: 'Project markdown context files', context: true },
]

function getRecordId(
	type: ConfigEntityType,
	record: unknown,
	selectedProject: ProjectRegistration | null,
): string {
	if (type === 'company') return 'company'
	if (type === 'project') return selectedProject?.id ?? 'project'
	if (
		typeof record === 'object' &&
		record !== null &&
		'id' in record &&
		typeof record.id === 'string'
	) {
		return record.id
	}
	return ''
}

function createDefaultRecord(type: ConfigEntityType, id: string) {
	switch (type) {
		case 'agents':
			return { id, name: '', role: 'developer', description: '', capability_profiles: [] }
		case 'workflows':
			return { id, name: '', description: '', steps: [] }
		case 'providers':
			return {
				id,
				name: '',
				kind: 'conversation_channel',
				handler: 'handlers/',
				capabilities: [],
				events: [],
				config: {},
				secret_refs: [],
				description: '',
			}
		case 'environments':
			return { id, name: '', description: '', required_tags: [], secret_refs: [] }
		case 'capabilities':
			return { id, description: '', skills: [], mcp_servers: [], context: [], prompts: [] }
		case 'skills':
			return {
				id,
				manifest: { name: id, description: '', tags: [], roles: ['all'], scripts: [] },
				body: '',
				path: `db://skills/${id}/SKILL.md`,
			}
		case 'scripts':
			return {
				id,
				name: '',
				description: '',
				entry_point: '',
				runner: 'exec',
				inputs: [],
				outputs: [],
				sandbox: {
					fs_scope: { read: ['.'], write: [] },
					network: 'unrestricted',
					timeout_ms: 300000,
				},
				tags: [],
			}
		case 'company':
			return { name: '', slug: '', description: '', defaults: {} }
		case 'project':
			return { name: '', description: '', defaults: {} }
		default:
			return {}
	}
}

function stringifyRecord(
	type: ConfigEntityType,
	record: unknown,
	selectedProject: ProjectRegistration | null,
): string {
	const id = getRecordId(type, record, selectedProject)
	if (!record) return JSON.stringify(createDefaultRecord(type, id), null, 2)
	if (type === 'context')
		return typeof (record as ContextConfigRecord).content === 'string'
			? (record as ContextConfigRecord).content
			: ''
	return JSON.stringify(record, null, 2)
}

export function ConfigSettings() {
	const { theme } = useAppPreferences()
	const projectsQuery = useProjects()
	const saveMutation = useSaveConfigRecord()
	const deleteMutation = useDeleteConfigRecord()
	const [scopeValue, setScopeValue] = useState<ScopeValue>('company')
	const [configType, setConfigType] = useState<ConfigEntityType>('company')
	const [selectedId, setSelectedId] = useState<string | null>('company')
	const [draftId, setDraftId] = useState('company')
	const [draftValue, setDraftValue] = useState('')
	const [contextValue, setContextValue] = useState('')
	const [parseError, setParseError] = useState<string | null>(null)
	const projectId = scopeValue.startsWith('project:') ? scopeValue.slice('project:'.length) : null
	const selectedProject =
		(projectsQuery.data ?? []).find((project) => project.id === projectId) ?? null
	const options = projectId ? PROJECT_TYPES : COMPANY_TYPES
	const currentType = options.find((option) => option.id === configType) ?? options[0]!
	const recordsQuery = useConfigRecords(configType, projectId)
	const editorTheme = theme === 'light' ? 'light' : 'vs-dark'

	const records = useMemo(() => {
		if (currentType.singleton) {
			return recordsQuery.data?.[0]
				? [recordsQuery.data[0]]
				: [createDefaultRecord(configType, draftId)]
		}
		return recordsQuery.data ?? []
	}, [configType, currentType.singleton, draftId, recordsQuery.data])

	const activeRecord = useMemo(() => {
		if (currentType.singleton) return records[0] ?? null
		return (
			records.find((record) => getRecordId(configType, record, selectedProject) === selectedId) ??
			null
		)
	}, [configType, currentType.singleton, records, selectedId, selectedProject])

	useEffect(() => {
		const nextType = projectId
			? configType === 'company'
				? 'project'
				: configType
			: configType === 'project'
				? 'company'
				: configType
		if (nextType !== configType) setConfigType(nextType)
	}, [configType, projectId])

	useEffect(() => {
		if (currentType.singleton) {
			const singletonId = configType === 'project' ? (selectedProject?.id ?? 'project') : 'company'
			setSelectedId(singletonId)
			setDraftId(singletonId)
			setDraftValue(
				stringifyRecord(
					configType,
					activeRecord ?? createDefaultRecord(configType, singletonId),
					selectedProject,
				),
			)
			setContextValue(
				stringifyRecord(
					configType,
					activeRecord ?? { id: singletonId, content: '', project_id: projectId },
					selectedProject,
				),
			)
			setParseError(null)
			return
		}

		if (activeRecord) {
			const id = getRecordId(configType, activeRecord, selectedProject)
			setDraftId(id)
			setDraftValue(stringifyRecord(configType, activeRecord, selectedProject))
			setContextValue(stringifyRecord(configType, activeRecord, selectedProject))
			setParseError(null)
		} else {
			setDraftId('')
			setDraftValue(stringifyRecord(configType, null, selectedProject))
			setContextValue('')
			setParseError(null)
		}
	}, [activeRecord, configType, currentType.singleton, projectId, selectedProject])

	function handleCreateNew() {
		if (currentType.singleton) return
		setSelectedId(null)
		setDraftId('')
		setDraftValue(stringifyRecord(configType, null, selectedProject))
		setContextValue('')
		setParseError(null)
	}

	async function handleSave() {
		const id = draftId.trim() || selectedId
		if (!id) {
			setParseError('Record ID is required.')
			return
		}

		try {
			setParseError(null)
			const data = currentType.context
				? { id, content: contextValue }
				: normalizeRecordPayload(configType, id, JSON.parse(draftValue))

			await saveMutation.mutateAsync({
				type: configType,
				id,
				data,
				projectId,
			})
			setSelectedId(id)
			toast.success(`${currentType.label} saved`)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to save config record'
			setParseError(message)
			toast.error(message)
		}
	}

	async function handleDelete() {
		const id = selectedId ?? draftId.trim()
		if (!id || currentType.singleton) return
		try {
			await deleteMutation.mutateAsync({ type: configType, id, projectId })
			setSelectedId(null)
			toast.success(`${currentType.label} deleted`)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete config record')
		}
	}

	return (
		<div className="space-y-6">
			<SurfaceSection
				title="Configuration"
				description="Manage authored config through the new DB-backed config surface. Company scope is the default; switch to a project to edit scoped overrides."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,220px)_auto]">
					<div>
						<p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
							Scope
						</p>
						<Select
							value={scopeValue}
							onChange={(event) => setScopeValue(event.target.value as ScopeValue)}
						>
							<option value="company">Company scope</option>
							{(projectsQuery.data ?? []).map((project) => (
								<option key={project.id} value={`project:${project.id}`}>
									Project: {project.name}
								</option>
							))}
						</Select>
					</div>

					<div>
						<p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
							Type
						</p>
						<Select
							value={configType}
							onChange={(event) => setConfigType(event.target.value as ConfigEntityType)}
						>
							{options.map((option) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</Select>
					</div>

					<div className="flex items-end justify-start md:justify-end">
						<Button variant="outline" onClick={handleCreateNew} disabled={currentType.singleton}>
							New record
						</Button>
					</div>
				</div>

				<div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
					<SurfaceSection
						title={currentType.label}
						description={currentType.description}
						contentClassName="p-0"
					>
						{recordsQuery.isPending || projectsQuery.isPending ? (
							<div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
								<Spinner size="sm" />
								<span className="text-sm">Loading records…</span>
							</div>
						) : recordsQuery.error ? (
							<p className="px-4 py-4 text-sm text-destructive">
								Failed to load config: {recordsQuery.error.message}
							</p>
						) : records.length === 0 && !currentType.singleton ? (
							<EmptyState
								icon={Settings2}
								title="No records yet"
								description="Create the first record for this config type."
								height="h-40"
							/>
						) : (
							<div className="divide-y divide-border/60">
								{records.map((record, index) => {
									const id = getRecordId(configType, record, selectedProject) || `record-${index}`
									const label =
										typeof record === 'object' &&
										record !== null &&
										'name' in record &&
										typeof record.name === 'string'
											? record.name
											: id
									const selected = (selectedId ?? draftId) === id

									return (
										<button
											key={id}
											type="button"
											onClick={() => setSelectedId(id)}
											className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-primary/8' : 'hover:bg-muted/30'}`}
										>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-foreground">{label}</p>
												<p className="truncate text-xs text-muted-foreground tabular-nums">{id}</p>
											</div>
											{selected ? <Badge variant="info">active</Badge> : null}
										</button>
									)
								})}
							</div>
						)}
					</SurfaceSection>

					<SurfaceSection
						title={
							selectedId
								? `Editing ${selectedId}`
								: `New ${currentType.label.slice(0, -1) || currentType.label}`
						}
						description={
							projectId
								? `Project override for ${selectedProject?.name ?? 'selected project'}`
								: 'Company scope record'
						}
						action={
							<div className="flex items-center gap-2">
								{!currentType.singleton && selectedId ? (
									<Button
										variant="destructive"
										size="sm"
										onClick={() => void handleDelete()}
										loading={deleteMutation.isPending}
									>
										Delete
									</Button>
								) : null}
								<Button
									size="sm"
									onClick={() => void handleSave()}
									loading={saveMutation.isPending}
								>
									Save
								</Button>
							</div>
						}
						contentClassName="space-y-4"
					>
						{!currentType.singleton && (
							<div>
								<p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
									Record ID
								</p>
								<Input
									value={draftId}
									onChange={(event) => setDraftId(event.target.value)}
									placeholder="record-id"
								/>
							</div>
						)}

						{currentType.context ? (
							<div className="rounded-xl border border-border/70 bg-card/60 px-4 py-4">
								<TiptapEditor
									content={contextValue}
									onChange={setContextValue}
									editable
									className="min-h-[420px]"
									contentClassName="min-h-[380px]"
								/>
							</div>
						) : (
							<div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
								<Editor
									height="520px"
									language="json"
									theme={editorTheme}
									value={draftValue}
									onChange={(value) => setDraftValue(value ?? '')}
									options={{
										minimap: { enabled: false },
										fontSize: 13,
										wordWrap: 'on',
										scrollBeyondLastLine: false,
									}}
								/>
							</div>
						)}

						{parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}
					</SurfaceSection>
				</div>
			</SurfaceSection>
		</div>
	)
}

function normalizeRecordPayload(type: ConfigEntityType, id: string, value: unknown) {
	if (type === 'company' || type === 'project') return value
	if (type === 'context') return { id, content: String(value ?? '') }
	if (typeof value === 'object' && value !== null) {
		return { ...value, id }
	}
	return { id }
}
