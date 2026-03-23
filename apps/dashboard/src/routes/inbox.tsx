import { PinCard } from '@/components/data/pin-card'
import { RejectDialog } from '@/components/data/reject-dialog'
import { TaskCard } from '@/components/data/task-card'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { TopBar } from '@/components/layout/top-bar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgents } from '@/hooks/use-agents'
import { useInbox } from '@/hooks/use-inbox'
import { useApproveTask, useRejectTask } from '@/hooks/use-tasks'
import { createFileRoute } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/inbox')({
	component: InboxPage,
})

function InboxPage() {
	const navigate = useNavigate()
	const { data: inbox, isLoading, isError } = useInbox()
	const { data: agents } = useAgents()
	const approveTask = useApproveTask()
	const rejectTask = useRejectTask()
	const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null)

	const agentRoleMap = useMemo(() => {
		const map: Record<string, string> = {}
		if (agents) {
			for (const a of agents) {
				map[a.id] = a.role
				map[a.name] = a.role
			}
		}
		return map
	}, [agents])

	const handleRejectSubmit = (reason: string) => {
		if (rejectingTaskId) {
			rejectTask.mutate({ taskId: rejectingTaskId, reason })
			setRejectingTaskId(null)
		}
	}

	const totalCount = (inbox?.tasks?.length ?? 0) + (inbox?.pins?.length ?? 0)

	return (
		<ErrorBoundary>
			<TopBar title="Inbox">
				{totalCount > 0 && (
					<Badge variant="default" className="font-mono text-[9px]">
						{totalCount} pending
					</Badge>
				)}
			</TopBar>
			<div className="flex-1 overflow-y-auto p-6 max-w-[900px]">
				{isLoading ? (
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-24 w-full" />
						))}
					</div>
				) : isError ? (
					<EmptyState
						icon={'\u26A0'}
						title="Cannot connect to orchestrator"
						description="Make sure it's running on :7778"
					/>
				) : !inbox?.tasks?.length && !inbox?.pins?.length ? (
					<EmptyState
						icon={'\u2713'}
						title="All clear"
						description="Nothing needs your attention right now."
					/>
				) : (
					<div className="space-y-6">
						{inbox?.tasks && inbox.tasks.length > 0 && (
							<div>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
									Tasks requiring attention
									<span className="text-[9px] opacity-60">{inbox.tasks.length}</span>
								</div>
								<div className="space-y-2">
									{inbox.tasks.map((task) => (
										<TaskCard
											key={task.id}
											task={task}
											onClick={() =>
												navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
											}
											onApprove={() => approveTask.mutate(task.id)}
											onReject={() => setRejectingTaskId(task.id)}
										/>
									))}
								</div>
							</div>
						)}

						{inbox?.pins && inbox.pins.length > 0 && (
							<div>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-3">
									Pins with actions
								</div>
								<div className="grid grid-cols-2 gap-2">
									{inbox.pins.map((pin) => (
										<PinCard
											key={pin.id}
											pin={pin}
											agentRole={pin.created_by ? agentRoleMap[pin.created_by] : undefined}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{rejectingTaskId && (
				<RejectDialog
					onSubmit={handleRejectSubmit}
					onClose={() => setRejectingTaskId(null)}
					isLoading={rejectTask.isPending}
				/>
			)}
		</ErrorBoundary>
	)
}
