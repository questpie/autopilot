import { workspaceInspectionDiff } from '@/api/workspace-inspection.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
	ArrowSquareOut,
	FileCode,
	GitBranch,
	GitMerge,
	GitPullRequest,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { DiffViewer } from '../../tasks/components/diff-viewer'

interface ProjectChangesPanelProps {
	runId: string
	selectedPath: string | null
	onSelectFile: (path: string) => void
}

function providerLabel(provider?: string | null): string {
	if (provider === 'github') return 'GitHub'
	if (provider === 'gitlab') return 'GitLab'
	if (provider === 'generic-git') return 'Git'
	return 'Local git'
}

function statusVariant(status: string): 'success' | 'destructive' | 'warning' | 'outline' {
	if (status === 'A') return 'success'
	if (status === 'D') return 'destructive'
	if (status === 'R') return 'warning'
	return 'outline'
}

function statusLabel(status: string): string {
	switch (status) {
		case 'A':
			return 'added'
		case 'D':
			return 'deleted'
		case 'M':
			return 'modified'
		case 'R':
			return 'renamed'
		default:
			return status.toLowerCase()
	}
}

function openExternal(url: string | null | undefined): void {
	if (!url) return
	window.open(url, '_blank', 'noopener,noreferrer')
}

export function ProjectChangesPanel({
	runId,
	selectedPath,
	onSelectFile,
}: ProjectChangesPanelProps) {
	const [diffPath, setDiffPath] = useState<string | null>(null)
	const diffQuery = useQuery({
		queryKey: ['workspace-inspection', 'diff', runId],
		queryFn: () => workspaceInspectionDiff(runId, null, true),
		staleTime: 10_000,
	})
	const diff = diffQuery.data
	const selectedDiff = useMemo(
		() => diff?.files.find((file) => file.path === selectedPath) ?? null,
		[diff?.files, selectedPath],
	)
	const dialogFile = diffPath ? (diff?.files.find((file) => file.path === diffPath) ?? null) : null
	const provider = providerLabel(diff?.git?.provider)
	const changeRequestLabel =
		diff?.git?.change_request_kind === 'merge_request' ? 'Create MR' : 'Create PR'

	if (diffQuery.isLoading) {
		return (
			<div className="border-b border-border bg-background/80 px-4 py-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Spinner size="sm" />
					<span>Loading project changes...</span>
				</div>
			</div>
		)
	}

	if (diffQuery.isError || !diff) {
		return (
			<div className="border-b border-border bg-background/80 px-4 py-3">
				<p className="text-sm text-destructive">Failed to load project changes.</p>
			</div>
		)
	}

	const changedFiles = diff.files.slice(0, 8)

	return (
		<>
			<div className="border-b border-border bg-background/80 px-4 py-3">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-2">
								<GitBranch size={16} className="text-muted-foreground" />
								<p className="text-sm font-medium text-foreground">Project changes</p>
							</div>
							<Badge variant="outline">{provider}</Badge>
							{diff.git?.web_url ? (
								<Badge variant="ghost" className="max-w-[260px] truncate">
									{diff.git.web_url.replace(/^https?:\/\//, '')}
								</Badge>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span className="tabular-nums">{diff.stats.files_changed} files</span>
							<span className="tabular-nums text-success">+{diff.stats.insertions}</span>
							<span className="tabular-nums text-destructive">-{diff.stats.deletions}</span>
							<span className="min-w-0 truncate">
								{diff.base}...{diff.head}
							</span>
						</div>
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button
							size="xs"
							variant="outline"
							disabled={!diff.git?.compare_url}
							onClick={() => openExternal(diff.git?.compare_url)}
						>
							<ArrowSquareOut size={14} />
							Compare
						</Button>
						<Button
							size="xs"
							variant="outline"
							disabled={!diff.git?.change_request_url}
							onClick={() => openExternal(diff.git?.change_request_url)}
						>
							{diff.git?.change_request_kind === 'merge_request' ? (
								<GitMerge size={14} />
							) : (
								<GitPullRequest size={14} />
							)}
							{changeRequestLabel}
						</Button>
					</div>
				</div>

				{changedFiles.length > 0 ? (
					<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
						{changedFiles.map((file) => {
							const active = selectedPath === file.path
							return (
								<button
									key={file.path}
									type="button"
									className={cn(
										'flex max-w-72 shrink-0 items-center gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-1.5 text-left transition-[background-color,border-color,color,transform] hover:bg-muted/35 active:scale-[0.97]',
										active && 'border-primary bg-primary/10 text-foreground',
									)}
									onClick={() => onSelectFile(file.path)}
									onDoubleClick={() => setDiffPath(file.path)}
									title={file.path}
								>
									<FileCode size={14} className="shrink-0 text-muted-foreground" />
									<span className="truncate text-xs text-foreground">{file.path}</span>
									<Badge variant={statusVariant(file.status)} className="shrink-0">
										{statusLabel(file.status)}
									</Badge>
								</button>
							)
						})}
						{diff.files.length > changedFiles.length ? (
							<span className="flex shrink-0 items-center px-2 text-xs text-muted-foreground">
								+{diff.files.length - changedFiles.length} more
							</span>
						) : null}
					</div>
				) : (
					<p className="mt-3 text-sm text-muted-foreground">No project changes in this run.</p>
				)}

				{selectedDiff ? (
					<div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted/10 px-2.5 py-1.5">
						<p className="min-w-0 truncate text-xs text-muted-foreground">
							Selected file has a diff.
						</p>
						<Button size="xs" variant="ghost" onClick={() => setDiffPath(selectedDiff.path)}>
							View diff
						</Button>
					</div>
				) : null}
			</div>

			<Dialog open={!!dialogFile} onOpenChange={(open) => !open && setDiffPath(null)}>
				<DialogContent className="flex max-h-[82vh] max-w-[min(1100px,calc(100vw-2rem))] flex-col overflow-hidden p-0">
					<DialogHeader className="shrink-0 px-4 pt-4 pb-3">
						<DialogTitle className="truncate text-sm font-semibold">
							{dialogFile?.path ?? 'Diff'}
						</DialogTitle>
					</DialogHeader>
					<div className="min-h-0 flex-1 overflow-auto">
						<DiffViewer diff={dialogFile?.diff ?? ''} />
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
