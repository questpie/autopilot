import type { VfsListEntry } from '@/api/types'
import { Spinner } from '@/components/ui/spinner'
import { useFilesList } from '@/hooks/use-files-source'
import { fileIcon } from '@/lib/file-icons'
import { cn } from '@/lib/utils'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { buildPathSegments, getBaseName } from '../lib/file-paths'

interface FileTreeSidebarProps {
	runId: string | null
	projectId: string | null
	selectedPath: string | null
	onOpenFile: (path: string) => void
	onOpenDirectory?: (path: string | null) => void
	className?: string
}

interface TreeBranchProps extends FileTreeSidebarProps {
	path: string | null
	level: number
	expanded: Set<string>
	onToggle: (path: string) => void
}

function ancestorSet(path: string | null): Set<string> {
	if (!path) return new Set()
	return new Set(
		buildPathSegments(path)
			.map((segment) => segment.path)
			.filter((segment): segment is string => Boolean(segment))
			.slice(0, -1),
	)
}

function TreeEntry({
	entry,
	level,
	runId,
	projectId,
	selectedPath,
	onOpenFile,
	onOpenDirectory,
	expanded,
	onToggle,
}: Omit<TreeBranchProps, 'path'> & { entry: VfsListEntry }) {
	const isDirectory = entry.type === 'directory'
	const isExpanded = expanded.has(entry.path)
	const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')

	return (
		<div>
			<button
				type="button"
				className={cn(
					'flex min-h-9 w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-[background-color,color,transform] hover:bg-muted/40 active:scale-[0.96]',
					selectedPath === entry.path && 'border-l-2 border-primary bg-muted/50 text-foreground',
				)}
				style={{ paddingLeft: 8 + level * 14 - (selectedPath === entry.path ? 2 : 0) }}
				onClick={() => {
					if (isDirectory) {
						onToggle(entry.path)
						onOpenDirectory?.(entry.path)
						return
					}
					onOpenFile(entry.path)
				}}
			>
				{isDirectory ? (
					isExpanded ? (
						<CaretDown size={12} className="shrink-0 text-muted-foreground" />
					) : (
						<CaretRight size={12} className="shrink-0 text-muted-foreground" />
					)
				) : (
					<span className="w-3 shrink-0" />
				)}
				<EntryIcon
					size={14}
					weight={isDirectory ? 'fill' : 'regular'}
					className="shrink-0 text-muted-foreground"
				/>
				<span className="truncate">{entry.name}</span>
			</button>

			{isDirectory && isExpanded ? (
				<TreeBranch
					path={entry.path}
					level={level + 1}
					runId={runId}
					projectId={projectId}
					selectedPath={selectedPath}
					onOpenFile={onOpenFile}
					onOpenDirectory={onOpenDirectory}
					expanded={expanded}
					onToggle={onToggle}
				/>
			) : null}
		</div>
	)
}

function TreeBranch({
	path,
	level,
	runId,
	projectId,
	selectedPath,
	onOpenFile,
	onOpenDirectory,
	expanded,
	onToggle,
}: TreeBranchProps) {
	const { data, isLoading, isError } = useFilesList(runId, path, projectId)
	const entries = data?.entries ?? []

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
				<Spinner size="sm" />
				<span>Loading...</span>
			</div>
		)
	}

	if (isError) {
		return <p className="px-2 py-2 text-xs text-destructive">Failed to load tree.</p>
	}

	return (
		<div className="space-y-0.5">
			{entries.map((entry) => (
				<TreeEntry
					key={entry.path}
					entry={entry}
					level={level}
					runId={runId}
					projectId={projectId}
					selectedPath={selectedPath}
					onOpenFile={onOpenFile}
					onOpenDirectory={onOpenDirectory}
					expanded={expanded}
					onToggle={onToggle}
				/>
			))}
		</div>
	)
}

export function FileTreeSidebar({
	runId,
	projectId,
	selectedPath,
	onOpenFile,
	onOpenDirectory,
	className,
}: FileTreeSidebarProps) {
	const [expanded, setExpanded] = useState(() => ancestorSet(selectedPath))
	const rootLabel = runId ? `Run ${runId.slice(0, 8)}` : 'Knowledge'
	const currentName = selectedPath ? getBaseName(selectedPath) : 'All files'

	useEffect(() => {
		setExpanded((current) => new Set([...current, ...ancestorSet(selectedPath)]))
	}, [selectedPath])

	function toggle(path: string) {
		setExpanded((current) => {
			const next = new Set(current)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	return (
		<div className={cn('h-full min-h-0 overflow-y-auto px-2 py-3', className)}>
			<div className="mb-3 px-2">
				<p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Files
				</p>
				<p className="mt-1 truncate text-sm font-medium text-foreground">{rootLabel}</p>
				<p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{currentName}</p>
			</div>
			<button
				type="button"
				className={cn(
					'mb-2 flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-[background-color,color,transform] hover:bg-muted/40 active:scale-[0.96]',
					!selectedPath && 'border-l-2 border-primary bg-muted/50 pl-1.5 text-foreground',
				)}
				onClick={() => onOpenDirectory?.(null)}
			>
				<span className="w-3 shrink-0" />
				<span className="truncate">All files</span>
			</button>
			<TreeBranch
				path={null}
				level={0}
				runId={runId}
				projectId={projectId}
				selectedPath={selectedPath}
				onOpenFile={onOpenFile}
				onOpenDirectory={onOpenDirectory}
				expanded={expanded}
				onToggle={toggle}
			/>
		</div>
	)
}
