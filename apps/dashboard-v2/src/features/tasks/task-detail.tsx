import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
	ArrowLeftIcon,
	CheckCircleIcon,
	CopySimpleIcon,
	DotsThreeIcon,
	Link as LinkIcon,
	TrashIcon,
	UserSwitchIcon,
	XCircleIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { TaskActivityTimeline } from './task-activity-timeline'
import { STATUS_COLORS, formatTaskId, formatTimeAgo } from './task-list-item'
import { useApproveTaskMutation, useRejectTaskMutation } from './task.mutations'
import { taskDetailQuery } from './task.queries'
import { WorkflowProgress } from './workflow-progress'
import { WorkflowRunPanel } from './workflow-run-panel'

interface TaskDetailProps {
	taskId: string
	onClose: () => void
}

export function TaskDetail({ taskId, onClose }: TaskDetailProps) {
	const { t } = useTranslation()
	const { data: task, isLoading } = useQuery(taskDetailQuery(taskId))
	const approveMutation = useApproveTaskMutation()
	const rejectMutation = useRejectTaskMutation()
	const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
	const [rejectReason, setRejectReason] = useState('')

	const isActionable =
		task?.status === 'review' || task?.status === 'blocked' || task?.type === 'human_required'

	function handleApprove() {
		if (!task) return
		approveMutation.mutate(task.id)
	}

	function handleReject() {
		if (!task) return
		rejectMutation.mutate(
			{ taskId: task.id, reason: rejectReason || undefined },
			{
				onSuccess: () => {
					setRejectDialogOpen(false)
					setRejectReason('')
				},
			},
		)
	}

	function handleCopyLink() {
		void navigator.clipboard.writeText(`${window.location.origin}/tasks/${taskId}`)
		toast.success(t('common.copied'))
	}

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-6">
				<div className="h-6 w-3/4 animate-pulse bg-muted" />
				<div className="h-4 w-1/2 animate-pulse bg-muted" />
				<div className="h-4 w-2/3 animate-pulse bg-muted" />
				<div className="mt-4 h-32 animate-pulse bg-muted" />
			</div>
		)
	}

	if (!task) {
		return (
			<div className="flex flex-1 items-center justify-center p-6">
				<p className="text-sm text-muted-foreground">{t('common.no_results')}</p>
			</div>
		)
	}

	return (
		<>
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t('a11y.close')}
							onClick={onClose}
							className="md:hidden"
						>
							<ArrowLeftIcon size={16} />
						</Button>
						<span className="font-heading text-xs text-muted-foreground">
							{formatTaskId(task.id)}
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						{isActionable && (
							<>
								<Button
									variant="default"
									size="sm"
									onClick={handleApprove}
									disabled={approveMutation.isPending}
									className="gap-1"
								>
									<CheckCircleIcon size={14} />
									{t('tasks.approve')}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setRejectDialogOpen(true)}
									disabled={rejectMutation.isPending}
									className="gap-1"
								>
									<XCircleIcon size={14} />
									{t('tasks.reject')}
								</Button>
							</>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button variant="ghost" size="icon-sm" aria-label={t('a11y.more_options')} />
								}
							>
								<DotsThreeIcon size={16} weight="bold" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem className="gap-2">
									<UserSwitchIcon size={14} />
									{t('tasks.actions_reassign')}
								</DropdownMenuItem>
								<DropdownMenuItem className="gap-2">
									<CopySimpleIcon size={14} />
									{t('tasks.actions_duplicate')}
								</DropdownMenuItem>
								<DropdownMenuItem className="gap-2" onClick={handleCopyLink}>
									<LinkIcon size={14} />
									{t('tasks.actions_copy_link')}
								</DropdownMenuItem>
								<DropdownMenuItem className="gap-2 text-destructive">
									<TrashIcon size={14} />
									{t('tasks.actions_delete')}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Scrollable body */}
				<ScrollArea className="flex-1">
					<div className="flex flex-col gap-6 p-6">
						{/* Title */}
						<h2 className="font-heading text-lg font-semibold text-foreground">{task.title}</h2>

						{/* Metadata grid */}
						<div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xs">
							<span className="font-heading text-muted-foreground">{t('tasks.detail_status')}</span>
							<div className="flex items-center gap-2">
								<div
									className={cn('h-2.5 w-2.5', STATUS_COLORS[task.status] ?? 'bg-muted-foreground')}
								/>
								<span className="capitalize">{task.status.replace('_', ' ')}</span>
							</div>

							<span className="font-heading text-muted-foreground">
								{t('tasks.detail_assigned')}
							</span>
							<span>{task.assigned_to ?? t('tasks.unassigned')}</span>

							{task.workflow && (
								<>
									<span className="font-heading text-muted-foreground">
										{t('tasks.detail_workflow')}
									</span>
									<span>
										{task.workflow}
										{task.workflow_step && ` / ${task.workflow_step}`}
									</span>
								</>
							)}

							<span className="font-heading text-muted-foreground">
								{t('tasks.detail_created')}
							</span>
							<span>
								{formatTimeAgo(task.created_at)} {t('common.by') ?? 'by'} {task.created_by}
							</span>

							{task.depends_on && task.depends_on.length > 0 && (
								<>
									<span className="font-heading text-muted-foreground">
										{t('tasks.detail_depends_on')}
									</span>
									<div className="flex flex-wrap gap-1">
										{task.depends_on.map((dep: string) => (
											<Badge key={dep} variant="outline" className="text-[10px]">
												{formatTaskId(dep)}
											</Badge>
										))}
									</div>
								</>
							)}

							{task.blocks && task.blocks.length > 0 && (
								<>
									<span className="font-heading text-muted-foreground">
										{t('tasks.detail_blocks')}
									</span>
									<div className="flex flex-wrap gap-1">
										{task.blocks.map((blk: string) => (
											<Badge key={blk} variant="outline" className="text-[10px]">
												{formatTaskId(blk)}
											</Badge>
										))}
									</div>
								</>
							)}
						</div>

						{/* Workflow progress */}
						{task.workflow && (
							<>
								<Separator />
								<WorkflowProgress
									workflowStep={task.workflow_step}
									history={task.history ?? []}
									status={task.status}
								/>

								<div className="flex flex-col gap-2">
									<h3 className="font-heading text-xs font-medium text-muted-foreground uppercase">
										Workflow runtime
									</h3>
									<WorkflowRunPanel taskId={task.id} />
								</div>
							</>
						)}

						{/* Description */}
						<Separator />
						<div className="flex flex-col gap-2">
							<h3 className="font-heading text-xs font-medium text-muted-foreground uppercase">
								{t('tasks.detail_description')}
							</h3>
							{task.description ? (
								<MarkdownRenderer content={task.description} mode="inline" />
							) : (
								<p className="text-xs text-muted-foreground italic">{t('tasks.no_description')}</p>
							)}
						</div>

						{/* Activity */}
						<Separator />
						<div className="flex flex-col gap-2">
							<h3 className="font-heading text-xs font-medium text-muted-foreground uppercase">
								{t('tasks.detail_activity')}
							</h3>
							<TaskActivityTimeline history={task.history ?? []} />
						</div>
					</div>
				</ScrollArea>
			</div>

			{/* Reject dialog */}
			<Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('tasks.reject_confirm')}</DialogTitle>
					</DialogHeader>
					<Textarea
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						placeholder={t('tasks.reject_reason_placeholder')}
						className="font-heading text-xs"
					/>
					<DialogFooter>
						<DialogClose render={<Button variant="ghost" />}>{t('common.cancel')}</DialogClose>
						<Button
							variant="destructive"
							onClick={handleReject}
							disabled={rejectMutation.isPending}
						>
							{t('tasks.reject')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
