import { X } from 'lucide-react'
import type { Task } from '@/lib/types'
import { StatusBadge } from './status-badge'
import { AgentAvatar } from './agent-avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface TaskDetailPanelProps {
	task: Task
	onClose: () => void
	onApprove?: () => void
	onReject?: () => void
}

export function TaskDetailPanel({ task, onClose, onApprove, onReject }: TaskDetailPanelProps) {
	return (
		<>
			{/* Overlay */}
			<div
				className="fixed inset-0 bg-black/40 z-40"
				onClick={onClose}
				onKeyDown={(e) => e.key === 'Escape' && onClose()}
			/>

			{/* Panel */}
			<div className="fixed top-0 right-0 h-screen w-[480px] max-w-full bg-background border-l border-border z-50 flex flex-col animate-[slide-in-right_0.3s_ease-out]">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-border">
					<div>
						<span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
						<h2 className="text-sm font-semibold mt-0.5">{task.title}</h2>
					</div>
					<Button size="icon-sm" variant="ghost" onClick={onClose}>
						<X size={16} />
					</Button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{/* Status & Meta */}
					<div className="space-y-2">
						<MetaRow label="STATUS">
							<StatusBadge status={task.status} />
						</MetaRow>
						{task.priority && <MetaRow label="PRIORITY">{task.priority}</MetaRow>}
						{task.assigned_to && (
							<MetaRow label="ASSIGNED">
								<div className="flex items-center gap-2">
									<AgentAvatar name={task.assigned_to} size="sm" />
									<span>{task.assigned_to}</span>
								</div>
							</MetaRow>
						)}
						{task.workflow && (
							<MetaRow label="WORKFLOW">
								{task.workflow}
								{task.workflow_step && ` / ${task.workflow_step}`}
							</MetaRow>
						)}
						{task.project && <MetaRow label="PROJECT">{task.project}</MetaRow>}
						{task.created_at && (
							<MetaRow label="CREATED">
								{new Date(task.created_at).toLocaleString()}
							</MetaRow>
						)}
					</div>

					{/* Context */}
					{task.context && Object.keys(task.context).length > 0 && (
						<>
							<Separator />
							<div>
								<SectionTitle>Context</SectionTitle>
								<div className="space-y-1">
									{Object.entries(task.context).map(([key, value]) => (
										<MetaRow key={key} label={key.toUpperCase()}>
											{value}
										</MetaRow>
									))}
								</div>
							</div>
						</>
					)}

					{/* Blockers */}
					{task.blockers && task.blockers.length > 0 && (
						<>
							<Separator />
							<div>
								<SectionTitle>Blockers</SectionTitle>
								{task.blockers.map((b, i) => (
									<div
										key={i}
										className="border-l-2 border-destructive pl-3 py-2 text-sm text-destructive"
									>
										{b.reason}
									</div>
								))}
							</div>
						</>
					)}

					{/* History */}
					{task.history && task.history.length > 0 && (
						<>
							<Separator />
							<div>
								<SectionTitle>History</SectionTitle>
								<div className="space-y-3">
									{task.history.map((entry, i) => (
										<div key={i} className="flex gap-3">
											<div className="flex flex-col items-center">
												<div
													className={cn(
														'w-2 h-2 rounded-full shrink-0 mt-1.5',
														i === 0 ? 'bg-primary' : 'bg-muted-foreground',
													)}
												/>
												{i < task.history!.length - 1 && (
													<div className="w-px flex-1 bg-border mt-1" />
												)}
											</div>
											<div className="pb-3">
												<div className="flex items-center gap-2">
													<span className="font-mono text-[10px] text-muted-foreground">
														{formatTime(entry.at)}
													</span>
													<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
														{entry.by}
													</span>
												</div>
												<div className="text-sm text-muted-foreground">
													{entry.action}
													{entry.note && ` — ${entry.note}`}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</>
					)}
				</div>

				{/* Actions */}
				{task.status === 'review' && (
					<div className="p-4 border-t border-border flex gap-2">
						<Button className="flex-1" onClick={onApprove}>
							Approve
						</Button>
						<Button className="flex-1" variant="destructive" onClick={onReject}>
							Reject
						</Button>
					</div>
				)}
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
			<span className="text-sm">{children}</span>
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

function formatTime(ts: string): string {
	const d = new Date(ts)
	if (Number.isNaN(d.getTime())) return ''
	return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
