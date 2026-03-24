import { X } from 'lucide-react'
import type { Agent, ActivityEntry } from '@/lib/types'
import { AgentAvatar } from './agent-avatar'
import { ActivityItem } from './activity-item'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivity } from '@/hooks/use-activity'
import { cn } from '@/lib/utils'
import { useMemo, useState, useEffect } from 'react'

interface AgentDetailPanelProps {
	agent: Agent
	onClose: () => void
}

export function AgentDetailPanel({ agent, onClose }: AgentDetailPanelProps) {
	const { data: allActivity, isLoading } = useActivity()

	const agentActivity = useMemo(() => {
		if (!allActivity) return []
		return allActivity.filter((a) => a.agent === agent.id).reverse()
	}, [allActivity, agent.id])

	const stats = useMemo(() => {
		const sessions = agentActivity.filter((a) => a.type === 'session_start').length
		const toolCalls = agentActivity.filter((a) => a.type === 'tool_call').length
		const lastStart = agentActivity.find((a) => a.type === 'session_start')
		const lastEnd = agentActivity.find((a) => a.type === 'session_end')
		const isActive = lastStart && (!lastEnd || new Date(lastStart.at) > new Date(lastEnd.at))
		return { sessions, toolCalls, isActive, currentTask: lastStart?.details?.taskId }
	}, [agentActivity])

	const statusText = stats.isActive ? 'active' : 'idle'
	const statusColor = stats.isActive ? 'text-success' : 'text-info'

	const fsScope = agent.fs_scope
		? [...(agent.fs_scope.read ?? []), ...(agent.fs_scope.write ?? [])].filter(
				(v, i, a) => a.indexOf(v) === i,
			)
		: []

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-0 right-0 h-screen w-[480px] max-w-full bg-background border-l border-border z-50 flex flex-col animate-[slide-in-right_0.3s_ease-out]">
				{/* Header */}
				<div className="flex items-start justify-between p-4 border-b border-border">
					<div className="flex items-center gap-3">
						<AgentAvatar name={agent.name} size="lg" />
						<div>
							<div className="font-mono text-sm font-bold tracking-tight">{agent.name}</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline" className="font-mono text-[9px]">
									{agent.role}
								</Badge>
								<span className={cn('font-mono text-[10px] uppercase', statusColor)}>
									{statusText}
								</span>
							</div>
						</div>
					</div>
					<Button size="icon-sm" variant="ghost" onClick={onClose}>
						<X size={16} />
					</Button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{/* Info */}
					<div className="space-y-2">
						{agent.model && <MetaRow label="MODEL">{agent.model}</MetaRow>}
						{agent.tools && agent.tools.length > 0 && (
							<MetaRow label="TOOLS">
								<div className="flex flex-wrap gap-1">
									{agent.tools.map((t) => (
										<Badge key={t} variant="secondary" className="text-[9px]">
											{t}
										</Badge>
									))}
								</div>
							</MetaRow>
						)}
						{fsScope.length > 0 && (
							<MetaRow label="FS SCOPE">
								<div className="font-mono text-[11px] text-muted-foreground">
									{fsScope.slice(0, 4).join(', ')}
									{fsScope.length > 4 && ` +${fsScope.length - 4} more`}
								</div>
							</MetaRow>
						)}
					</div>

					{/* Current Session */}
					{stats.isActive && (
						<LiveSessionSection agent={agent} activity={agentActivity} currentTask={stats.currentTask} />
					)}

					{/* Today Stats */}
					<Separator />
					<div>
						<SectionTitle>Today</SectionTitle>
						<div className="grid grid-cols-2 gap-2">
							<StatCard label="Sessions" value={stats.sessions} />
							<StatCard label="Tool Calls" value={stats.toolCalls} />
						</div>
					</div>

					{/* Recent Activity */}
					<Separator />
					<div>
						<SectionTitle>Recent Activity</SectionTitle>
						{isLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton key={i} className="h-8 w-full" />
								))}
							</div>
						) : agentActivity.length > 0 ? (
							<div className="divide-y divide-border">
								{agentActivity.slice(0, 20).map((entry, i) => (
									<ActivityItem
										key={`${entry.at}-${i}`}
										entry={entry}
										agentRole={agent.role}
									/>
								))}
							</div>
						) : (
							<div className="text-sm text-muted-foreground">No recent activity</div>
						)}
					</div>
				</div>
			</div>
		</>
	)
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-4">
			<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] w-20 shrink-0 pt-0.5">
				{label}
			</span>
			<span className="text-sm flex-1">{children}</span>
		</div>
	)
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
			{children}
		</div>
	)
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="border border-border bg-card p-2 text-center">
			<div className="font-mono text-lg font-bold">{value}</div>
			<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.1em]">
				{label}
			</div>
		</div>
	)
}

const TOOL_COLORS: Record<string, string> = {
	Read: 'text-muted-foreground',
	Glob: 'text-muted-foreground',
	Grep: 'text-muted-foreground',
	Write: 'text-success',
	Edit: 'text-success',
	Bash: 'text-warning',
	mcp__autopilot: 'text-primary',
}

function LiveSessionSection({
	agent,
	activity,
	currentTask,
}: {
	agent: Agent
	activity: ActivityEntry[]
	currentTask?: string
}) {
	const [elapsed, setElapsed] = useState('')

	const sessionStart = activity.find((a) => a.type === 'session_start')
	const startTime = sessionStart ? new Date(sessionStart.at).getTime() : Date.now()

	useEffect(() => {
		const update = () => {
			const diff = Date.now() - startTime
			const mins = Math.floor(diff / 60000)
			const secs = Math.floor((diff % 60000) / 1000)
			setElapsed(`${mins}m ${secs.toString().padStart(2, '0')}s`)
		}
		update()
		const interval = setInterval(update, 1000)
		return () => clearInterval(interval)
	}, [startTime])

	const recentToolCalls = activity
		.filter((a) => a.type === 'tool_call')
		.slice(0, 10)

	return (
		<div>
			<div className="flex items-center gap-2 mb-3">
				<span className="w-2 h-2 bg-success rounded-full animate-[pulse-dot_2s_ease-in-out_infinite]" />
				<span className="font-mono text-[11px] text-success">
					Session running
				</span>
				<span className="font-mono text-[10px] text-muted-foreground">
					{elapsed}
				</span>
			</div>
			{currentTask && (
				<div className="text-sm mb-3">
					Task: <span className="font-mono text-primary">{currentTask}</span>
				</div>
			)}
			{recentToolCalls.length > 0 && (
				<div className="space-y-1">
					{recentToolCalls.map((entry, i) => {
						const tool = entry.details?.tool ?? ''
						const colorClass = Object.entries(TOOL_COLORS).find(([k]) =>
							tool.startsWith(k),
						)?.[1] ?? 'text-muted-foreground'
						return (
							<div key={`${entry.at}-${i}`} className="flex items-center gap-2 text-[11px]">
								<span className={cn('font-mono', colorClass)}>{tool}</span>
								<span className="text-muted-foreground truncate">{entry.summary}</span>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
