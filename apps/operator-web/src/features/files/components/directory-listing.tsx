import { knowledgeDelete, knowledgeUpload, knowledgeWrite } from '@/api/knowledge.api'
import type { VfsListEntry } from '@/api/types'
import { Button } from '@/components/ui/button'
import { InspectorHeader } from '@/components/ui/inspector-layout'
import { Spinner } from '@/components/ui/spinner'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import { filesList, filesSourceKeys } from '@/hooks/use-files-source'
import { fileIcon } from '@/lib/file-icons'
import { cn } from '@/lib/utils'
import { CaretRight } from '@phosphor-icons/react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { toast } from 'sonner'
import {
	type SavedFilesLocation,
	buildColumnPaths,
	formatBytes,
	getBaseName,
} from '../lib/file-paths'
import { FileTreeSidebar } from './file-tree-sidebar'
import { FilesSelectionInspector } from './files-selection-inspector'
import { InspectorShell } from './inspector-shell'

interface DirectoryListingProps {
	path: string | null
	runId: string | null
	projectId: string | null
	selectedPath: string | null
	isSelectionPinned: boolean
	onTogglePinned: (location: SavedFilesLocation) => void
	onSelectItem: (path: string, type: 'file' | 'directory') => void
	onOpenItem: (path: string | null, type: 'file' | 'directory') => void
}

interface ColumnEntryProps {
	entry: VfsListEntry
	runId: string | null
	selected: boolean
	onSelectItem: (path: string, type: 'file' | 'directory') => void
	onOpenItem: (path: string | null, type: 'file' | 'directory') => void
}

function ColumnEntry({ entry, runId, selected, onSelectItem, onOpenItem }: ColumnEntryProps) {
	const isDirectory = entry.type === 'directory'
	const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')

	function select() {
		if (isDirectory) {
			onOpenItem(entry.path, 'directory')
			return
		}
		onSelectItem(entry.path, 'file')
	}

	return (
		<button
			type="button"
			className={cn(
				'flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-[background-color,color,transform] hover:bg-muted/40 active:scale-[0.96]',
				selected && 'border-l-2 border-primary bg-muted/50 pl-2.5 text-foreground',
			)}
			draggable
			onDragStart={(e) => {
				setDraggedChatAttachment(e.dataTransfer, {
					type: 'ref',
					source: 'drag',
					label: entry.path,
					refType: isDirectory ? 'directory' : 'file',
					refId: entry.path,
					metadata: { view: 'files', path: entry.path, runId },
				})
			}}
			onClick={select}
			onDoubleClick={() => onOpenItem(entry.path, isDirectory ? 'directory' : 'file')}
		>
			<EntryIcon
				size={15}
				weight={isDirectory ? 'fill' : 'regular'}
				className="shrink-0 text-muted-foreground"
			/>
			<span className="flex-1 truncate text-sm text-foreground">{entry.name}</span>
			{isDirectory ? (
				<CaretRight size={14} className="shrink-0 text-muted-foreground" />
			) : entry.size !== undefined ? (
				<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
					{formatBytes(entry.size)}
				</span>
			) : null}
		</button>
	)
}

function ColumnsBrowser({
	path,
	runId,
	projectId,
	selectedPath,
	onSelectItem,
	onOpenItem,
}: Pick<
	DirectoryListingProps,
	'path' | 'runId' | 'projectId' | 'selectedPath' | 'onSelectItem' | 'onOpenItem'
>) {
	const columnPaths = buildColumnPaths(path)
	const parts = path?.split('/').filter(Boolean) ?? []
	const columns = useQueries({
		queries: columnPaths.map((columnPath) => ({
			queryKey: filesSourceKeys.list(runId, columnPath, projectId),
			queryFn: () => filesList(runId, columnPath, projectId),
		})),
	})

	return (
		<div className="flex h-full gap-3 overflow-x-auto px-4 py-3">
			{columnPaths.map((columnPath, index) => {
				const result = columns[index]
				const selectedName =
					index === columnPaths.length - 1 ? getBaseName(selectedPath) : (parts[index] ?? null)
				const title = index === 0 ? 'Root' : (columnPath?.split('/').pop() ?? 'Directory')

				return (
					<div
						key={columnPath ?? '__root__'}
						className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-muted/10 px-2 py-2"
					>
						<div className="px-2 py-1">
							<p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto">
							{result.isLoading ? (
								<div className="flex items-center justify-center py-8">
									<Spinner size="sm" className="text-muted-foreground" />
								</div>
							) : result.isError ? (
								<p className="px-3 py-4 text-sm text-destructive">Failed to load.</p>
							) : result.data?.entries.length ? (
								result.data.entries.map((entry) => (
									<ColumnEntry
										key={entry.path}
										entry={entry}
										runId={runId}
										selected={entry.name === selectedName || selectedPath === entry.path}
										onSelectItem={onSelectItem}
										onOpenItem={onOpenItem}
									/>
								))
							) : (
								<p className="px-3 py-4 text-sm text-muted-foreground">Empty</p>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}

export function DirectoryListing({
	path,
	runId,
	projectId,
	selectedPath,
	isSelectionPinned,
	onTogglePinned,
	onSelectItem,
	onOpenItem,
}: DirectoryListingProps) {
	const headerTitle = runId
		? `Run workspace${path ? ` / ${path}` : ''}`
		: `Knowledge${path ? ` / ${path}` : ''}`
	const queryClient = useQueryClient()
	const uploadInputRef = useRef<HTMLInputElement | null>(null)
	const scope = { projectId }

	async function refreshKnowledge() {
		await queryClient.invalidateQueries({ queryKey: filesSourceKeys.all })
	}

	async function handleCreateMarkdown() {
		const basePath = path ? `${path}/untitled.md` : 'untitled.md'
		const nextPath = window.prompt('Knowledge path', basePath)
		if (!nextPath?.trim()) return
		try {
			await knowledgeWrite(nextPath.trim(), '# Untitled\n', 'text/markdown', scope)
			await refreshKnowledge()
			onOpenItem(nextPath.trim(), 'file')
			toast.success('Knowledge document created')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create document')
		}
	}

	async function handleUpload(file: File) {
		const targetPath = path ? `${path}/${file.name}` : file.name
		try {
			await knowledgeUpload(targetPath, file, scope)
			await refreshKnowledge()
			toast.success('File uploaded')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload file')
		}
	}

	async function handleDeleteSelected() {
		if (runId || !selectedPath) return
		if (!window.confirm(`Delete ${selectedPath}?`)) return
		try {
			await knowledgeDelete(selectedPath, scope)
			await refreshKnowledge()
			toast.success('Knowledge document deleted')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete document')
		}
	}

	const toolbar = runId ? null : (
		<div className="flex flex-wrap items-center justify-end gap-2">
			<Button size="xs" variant="outline" onClick={() => void handleCreateMarkdown()}>
				New
			</Button>
			<Button size="xs" variant="outline" onClick={() => uploadInputRef.current?.click()}>
				Upload
			</Button>
			{selectedPath ? (
				<Button size="xs" variant="ghost" onClick={() => void handleDeleteSelected()}>
					Delete
				</Button>
			) : null}
			<input
				ref={uploadInputRef}
				type="file"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0]
					event.target.value = ''
					if (file) void handleUpload(file)
				}}
			/>
		</div>
	)

	const mainContent = (
		<ColumnsBrowser
			path={path}
			runId={runId}
			projectId={projectId}
			selectedPath={selectedPath}
			onSelectItem={onSelectItem}
			onOpenItem={onOpenItem}
		/>
	)

	return (
		<InspectorShell
			header={
				<InspectorHeader
					title={headerTitle}
					actions={toolbar ? [{ type: 'custom', id: 'knowledge-actions', render: toolbar }] : []}
				/>
			}
			content={
				<div className="flex h-full min-h-0 overflow-hidden">
					<aside className="hidden w-60 shrink-0 border-r border-border bg-muted/5 lg:block">
						<FileTreeSidebar
							runId={runId}
							projectId={projectId}
							selectedPath={selectedPath ?? path}
							onOpenFile={(nextPath) => onOpenItem(nextPath, 'file')}
							onOpenDirectory={(nextPath) => onOpenItem(nextPath, 'directory')}
						/>
					</aside>
					<div className="min-w-0 flex-1 overflow-hidden">{mainContent}</div>
				</div>
			}
			sidebar={
				<FilesSelectionInspector
					currentPath={path}
					selectedPath={selectedPath}
					runId={runId}
					projectId={projectId}
					isPinned={isSelectionPinned}
					onOpenSelected={onOpenItem}
					onTogglePinned={onTogglePinned}
				/>
			}
			sidebarClassName="lg:w-[320px]"
		/>
	)
}
