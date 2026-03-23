import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { TopBar } from '@/components/layout/top-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgents } from '@/hooks/use-agents'
import { useSkills } from '@/hooks/use-skills'
import { useStatus } from '@/hooks/use-status'
import { apiFetch, apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/settings')({
	component: SettingsPage,
})

const TABS = [
	'General',
	'Agents',
	'Workflows',
	'Schedules',
	'Secrets',
	'Skills',
	'Roles',
	'Webhooks',
] as const
type Tab = (typeof TABS)[number]

function SettingsPage() {
	const [activeTab, setActiveTab] = useState<Tab>('General')

	return (
		<ErrorBoundary>
			<TopBar title="Settings" />
			<div className="flex border-b border-border overflow-x-auto">
				{TABS.map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={cn(
							'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 cursor-pointer border-b-2 -mb-px transition-colors whitespace-nowrap',
							activeTab === tab
								? 'text-primary border-primary'
								: 'text-muted-foreground border-transparent hover:text-foreground',
						)}
					>
						{tab}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto p-6 max-w-[800px]">
				{activeTab === 'General' && <GeneralTab />}
				{activeTab === 'Agents' && <AgentsTab />}
				{activeTab === 'Workflows' && <WorkflowsTab />}
				{activeTab === 'Schedules' && <SchedulesTab />}
				{activeTab === 'Secrets' && <SecretsTab />}
				{activeTab === 'Skills' && <SkillsTab />}
				{activeTab === 'Roles' && <RolesTab />}
				{activeTab === 'Webhooks' && <YamlViewerTab path="webhooks.yaml" />}
			</div>
		</ErrorBoundary>
	)
}

function GeneralTab() {
	const { data: status, isLoading: statusLoading } = useStatus()
	const { data: companyConfig, isLoading: configLoading } = useQuery({
		queryKey: ['company-config'],
		queryFn: () => apiFetch<string>('/fs/company.yaml'),
	})

	if (statusLoading || configLoading) return <LoadingSkeleton />

	return (
		<div className="space-y-6">
			<Section title="Company">
				<InfoRow label="Name" value={status?.company ?? 'Unknown'} />
				<InfoRow label="Agents" value={String(status?.agentCount ?? 0)} />
				<InfoRow label="Active Tasks" value={String(status?.activeTasks ?? 0)} />
				<InfoRow label="Running Sessions" value={String(status?.runningSessions ?? 0)} />
			</Section>
			<Section title="Company Config (YAML)">
				<pre className="font-mono text-[12px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
					{typeof companyConfig === 'string'
						? companyConfig
						: JSON.stringify(companyConfig, null, 2)}
				</pre>
			</Section>
		</div>
	)
}

function AgentsTab() {
	const { data: agents, isLoading } = useAgents()

	if (isLoading) return <LoadingSkeleton />
	if (!agents || agents.length === 0) return <EmptyState title="No agents configured" />

	return (
		<div className="border border-border overflow-hidden">
			<table className="w-full">
				<thead>
					<tr className="border-b border-border bg-secondary">
						{['ID', 'Name', 'Role', 'Model', 'Tools'].map((h) => (
							<th
								key={h}
								className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] text-left px-3 py-2 font-semibold"
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{agents.map((agent) => (
						<tr key={agent.id} className="border-b border-border last:border-b-0">
							<td className="font-mono text-[11px] px-3 py-2">{agent.id}</td>
							<td className="font-mono text-[11px] px-3 py-2 font-medium">{agent.name}</td>
							<td className="px-3 py-2">
								<Badge variant="outline" className="font-mono text-[9px]">
									{agent.role}
								</Badge>
							</td>
							<td className="font-mono text-[10px] text-muted-foreground px-3 py-2">
								{agent.model ?? '-'}
							</td>
							<td className="px-3 py-2">
								<div className="flex flex-wrap gap-1">
									{agent.tools?.slice(0, 3).map((t) => (
										<Badge key={t} variant="secondary" className="text-[8px]">
											{t}
										</Badge>
									))}
									{(agent.tools?.length ?? 0) > 3 && (
										<Badge variant="secondary" className="text-[8px]">
											+{(agent.tools?.length ?? 0) - 3}
										</Badge>
									)}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

interface ScheduleEntry {
	id?: string
	agent?: string
	cron?: string
	description?: string
	enabled?: boolean
}

function parseSchedulesYaml(raw: string): ScheduleEntry[] {
	const entries: ScheduleEntry[] = []
	let current: ScheduleEntry | null = null

	for (const line of raw.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.startsWith('- ')) {
			if (current) entries.push(current)
			current = {}
			const rest = trimmed.slice(2)
			const [key, ...vals] = rest.split(':')
			if (key && vals.length > 0) {
				;(current as Record<string, unknown>)[key.trim()] = vals.join(':').trim()
			}
		} else if (current && trimmed.includes(':')) {
			const [key, ...vals] = trimmed.split(':')
			const k = key?.trim() ?? ''
			const v = vals.join(':').trim()
			if (k === 'enabled') {
				current.enabled = v === 'true'
			} else {
				;(current as Record<string, unknown>)[k] = v
			}
		}
	}
	if (current) entries.push(current)
	return entries
}

function SchedulesTab() {
	const { data, isLoading } = useQuery({
		queryKey: ['schedules-yaml'],
		queryFn: () => apiFetch<string>('/fs/team/schedules.yaml'),
	})

	if (isLoading) return <LoadingSkeleton />
	if (!data) return <EmptyState title="No schedules configured" />

	const raw = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
	const schedules = parseSchedulesYaml(raw)
	if (schedules.length === 0) return <EmptyState title="No schedules configured" />

	return (
		<div className="border border-border overflow-hidden">
			<table className="w-full">
				<thead>
					<tr className="border-b border-border bg-secondary">
						{['ID', 'Agent', 'Cron', 'Description', 'Enabled'].map((h) => (
							<th
								key={h}
								className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] text-left px-3 py-2 font-semibold"
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{schedules.map((s, i) => (
						<tr key={s.id ?? i} className="border-b border-border last:border-b-0">
							<td className="font-mono text-[11px] px-3 py-2">{s.id ?? '-'}</td>
							<td className="font-mono text-[11px] px-3 py-2">{s.agent ?? '-'}</td>
							<td className="font-mono text-[11px] px-3 py-2 text-muted-foreground">
								{s.cron ?? '-'}
							</td>
							<td className="font-mono text-[11px] px-3 py-2">{s.description ?? '-'}</td>
							<td className="font-mono text-[11px] px-3 py-2">
								<Badge
									variant={s.enabled !== false ? 'default' : 'secondary'}
									className="text-[9px]"
								>
									{s.enabled !== false ? 'ON' : 'OFF'}
								</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function SecretsTab() {
	const { data, isLoading } = useQuery({
		queryKey: ['secrets-list'],
		queryFn: () => apiFetch<Array<{ name: string; type: string; size: number }>>('/fs/secrets'),
	})
	const [showAdd, setShowAdd] = useState(false)
	const [newName, setNewName] = useState('')
	const [newValue, setNewValue] = useState('')

	if (isLoading) return <LoadingSkeleton />

	const secrets = Array.isArray(data) ? data.filter((f) => f.name.endsWith('.yaml')) : []

	const handleAdd = () => {
		if (!newName.trim()) return
		apiPost('/api/secrets', { name: newName.trim(), value: newValue })
			.then(() => {
				setShowAdd(false)
				setNewName('')
				setNewValue('')
			})
			.catch(() => {})
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
					{showAdd ? 'Cancel' : 'Add Secret'}
				</Button>
			</div>
			{showAdd && (
				<div className="border border-border bg-card p-4 space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
								Name
							</label>
							<Input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="SECRET_NAME"
							/>
						</div>
						<div>
							<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
								Value
							</label>
							<Input
								type="password"
								value={newValue}
								onChange={(e) => setNewValue(e.target.value)}
								placeholder="secret value"
							/>
						</div>
					</div>
					<Button size="sm" onClick={handleAdd}>
						Save Secret
					</Button>
				</div>
			)}
			{secrets.length === 0 ? (
				<EmptyState
					title="No secrets"
					description="Add secrets via CLI: autopilot secrets set <name>"
				/>
			) : (
				<div className="space-y-2">
					{secrets.map((s) => (
						<div
							key={s.name}
							className="flex items-center justify-between border border-border bg-card px-3 py-2"
						>
							<span className="font-mono text-[11px]">{s.name.replace(/\.yaml$/, '')}</span>
							<span className="font-mono text-[10px] text-muted-foreground">********</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function SkillsTab() {
	const { data: skills, isLoading } = useSkills()

	if (isLoading) return <LoadingSkeleton />

	const skillList = Array.isArray(skills) ? skills : []
	if (skillList.length === 0) return <EmptyState title="No skills loaded" />

	return (
		<div className="space-y-2">
			{skillList.map((skill) => (
				<div key={skill.id ?? skill.name} className="border border-border bg-card p-3 space-y-1">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{skill.name}</span>
						{skill.format && (
							<Badge variant="secondary" className="text-[9px]">
								{skill.format}
							</Badge>
						)}
					</div>
					{skill.description && (
						<div className="text-[11px] text-muted-foreground">{skill.description}</div>
					)}
					{skill.roles && skill.roles.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-1">
							{skill.roles.map((r) => (
								<Badge key={r} variant="outline" className="text-[8px]">
									{r}
								</Badge>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	)
}

function RolesTab() {
	const { data, isLoading } = useQuery({
		queryKey: ['roles-yaml'],
		queryFn: () => apiFetch<string>('/fs/team/roles.yaml'),
	})

	if (isLoading) return <LoadingSkeleton />
	if (!data) return <EmptyState title="No roles configured" />

	const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

	return (
		<pre className="font-mono text-[12px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
			{text}
		</pre>
	)
}

function WorkflowsTab() {
	const [selectedFile, setSelectedFile] = useState<string | null>(null)

	const { data: files, isLoading } = useQuery({
		queryKey: ['workflows-list'],
		queryFn: () => apiFetch<Array<{ name: string; type: string }>>('/fs/team/workflows/'),
	})

	const { data: fileContent, isLoading: contentLoading } = useQuery({
		queryKey: ['workflow-file', selectedFile],
		queryFn: () => apiFetch<string>(`/fs/team/workflows/${selectedFile}`),
		enabled: !!selectedFile,
	})

	if (isLoading) return <LoadingSkeleton />

	const fileList = Array.isArray(files)
		? files.filter((f) => f.name.endsWith('.yaml') || f.name.endsWith('.yml'))
		: []
	if (fileList.length === 0) return <EmptyState title="No workflows found" />

	return (
		<div className="space-y-4">
			<div className="space-y-1">
				{fileList.map((f) => (
					<button
						key={f.name}
						onClick={() => setSelectedFile(selectedFile === f.name ? null : f.name)}
						className={cn(
							'w-full text-left font-mono text-[11px] px-3 py-2 border border-border cursor-pointer transition-colors',
							selectedFile === f.name
								? 'bg-secondary text-foreground'
								: 'bg-card text-muted-foreground hover:text-foreground',
						)}
					>
						{f.name}
					</button>
				))}
			</div>
			{selectedFile && (
				<div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
						{selectedFile}
					</div>
					{contentLoading ? (
						<LoadingSkeleton />
					) : (
						<pre className="font-mono text-[12px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
							{typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent, null, 2)}
						</pre>
					)}
				</div>
			)}
		</div>
	)
}

function YamlViewerTab({ path }: { path: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ['yaml-viewer', path],
		queryFn: () => apiFetch<string>(`/fs/${path}`),
	})

	if (isLoading) return <LoadingSkeleton />
	if (!data) return <EmptyState title={`No ${path} found`} />

	const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

	return (
		<pre className="font-mono text-[12px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
			{text}
		</pre>
	)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-3">
				{title}
			</h2>
			<div className="space-y-2">{children}</div>
		</div>
	)
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between border border-border bg-card px-3 py-2">
			<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
				{label}
			</span>
			<span className="text-sm font-medium">{value}</span>
		</div>
	)
}

function LoadingSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 6 }).map((_, i) => (
				<Skeleton key={i} className="h-12 w-full" />
			))}
		</div>
	)
}
