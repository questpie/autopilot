import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretRight, CaretDown, File, FolderOpen, Folder } from '@phosphor-icons/react'
import { apiFetch, queryKeys } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface FsEntry {
	name: string
	type: 'file' | 'directory'
	size?: number
}

interface FileTreeProps {
	basePath: string
	selectedPath?: string
	onSelect: (path: string) => void
}

export function FileTree({ basePath, selectedPath, onSelect }: FileTreeProps) {
	return (
		<div className="py-2">
			<TreeDirectory
				path={basePath}
				depth={0}
				selectedPath={selectedPath}
				onSelect={onSelect}
				defaultExpanded
			/>
		</div>
	)
}

function TreeDirectory({
	path,
	depth,
	selectedPath,
	onSelect,
	defaultExpanded = false,
}: {
	path: string
	depth: number
	selectedPath?: string
	onSelect: (path: string) => void
	defaultExpanded?: boolean
}) {
	const [expanded, setExpanded] = useState(defaultExpanded)

	const { data: entries, isLoading } = useQuery({
		queryKey: queryKeys.directory(path),
		queryFn: () => apiFetch<FsEntry[]>(`/fs/${path}`),
		enabled: expanded,
	})

	const name = path.split('/').filter(Boolean).pop() ?? path

	// For root level, don't show a toggle — just show children
	if (defaultExpanded && depth === 0) {
		if (isLoading) {
			return (
				<div className="space-y-1 px-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-6 w-full" />
					))}
				</div>
			)
		}

		return (
			<div>
				{entries?.map((entry) => {
					const entryPath = `${path}/${entry.name}`
					return entry.type === 'directory' ? (
						<TreeDirectory
							key={entryPath}
							path={entryPath}
							depth={depth + 1}
							selectedPath={selectedPath}
							onSelect={onSelect}
						/>
					) : (
						<TreeFile
							key={entryPath}
							name={entry.name}
							path={entryPath}
							depth={depth + 1}
							isSelected={selectedPath === entryPath}
							onSelect={onSelect}
						/>
					)
				})}
			</div>
		)
	}

	return (
		<div>
			<button
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-1.5 w-full text-left py-1 px-2 text-[13px] hover:bg-accent transition-colors cursor-pointer"
				style={{ paddingLeft: depth * 16 }}
			>
				{expanded ? (
					<CaretDown size={12} className="text-muted-foreground shrink-0" />
				) : (
					<CaretRight size={12} className="text-muted-foreground shrink-0" />
				)}
				{expanded ? (
					<FolderOpen size={14} className="text-muted-foreground shrink-0" />
				) : (
					<Folder size={14} className="text-muted-foreground shrink-0" />
				)}
				<span className="truncate">{name}</span>
			</button>
			{expanded && (
				<div>
					{isLoading ? (
						<div className="space-y-1" style={{ paddingLeft: (depth + 1) * 16 + 8 }}>
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="h-5 w-3/4" />
							))}
						</div>
					) : (
						entries?.map((entry) => {
							const entryPath = `${path}/${entry.name}`
							return entry.type === 'directory' ? (
								<TreeDirectory
									key={entryPath}
									path={entryPath}
									depth={depth + 1}
									selectedPath={selectedPath}
									onSelect={onSelect}
								/>
							) : (
								<TreeFile
									key={entryPath}
									name={entry.name}
									path={entryPath}
									depth={depth + 1}
									isSelected={selectedPath === entryPath}
									onSelect={onSelect}
								/>
							)
						})
					)}
				</div>
			)}
		</div>
	)
}

function TreeFile({
	name,
	path,
	depth,
	isSelected,
	onSelect,
}: {
	name: string
	path: string
	depth: number
	isSelected: boolean
	onSelect: (path: string) => void
}) {
	return (
		<button
			onClick={() => onSelect(path)}
			className={cn(
				'flex items-center gap-1.5 w-full text-left py-1 px-2 text-[13px] transition-colors cursor-pointer',
				isSelected
					? 'bg-accent text-primary'
					: 'hover:bg-accent',
			)}
			style={{ paddingLeft: depth * 16 + 16 }}
		>
			<File size={14} className="text-muted-foreground shrink-0" />
			<span className="truncate">{name}</span>
		</button>
	)
}
