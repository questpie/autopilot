import { knowledgeContentUrl } from '@/api/knowledge.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KvList } from '@/components/ui/kv-list'
import { Spinner } from '@/components/ui/spinner'
import { buildChatContextSearch } from '@/features/chat/lib/chat-context'
import { useFilesList, useFilesRead, useFilesStat } from '@/hooks/use-files-source'
import { resolveViewer } from '@/lib/viewer-registry'
import { ArrowSquareOut, ChatCircle, Folder, PushPin, PushPinSlash } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import {
	type SavedFilesLocation,
	buildContentUrl,
	buildWorkspaceUri,
	formatBytes,
	getBaseName,
} from '../lib/file-paths'
import { FilePreviewSurface } from './file-preview-surface'

interface FilesSelectionInspectorProps {
	currentPath: string | null
	selectedPath: string | null
	runId: string | null
	projectId: string | null
	isPinned: boolean
	onOpenSelected: (path: string, type: 'file' | 'directory') => void
	onTogglePinned: (location: SavedFilesLocation) => void
}

function buildLocation(
	path: string | null,
	runId: string | null,
	type: 'file' | 'directory',
): SavedFilesLocation {
	return {
		path,
		runId,
		type,
		label: getBaseName(path, type === 'directory' ? 'Company' : 'File'),
		viewedAt: new Date().toISOString(),
	}
}

export function FilesSelectionInspector({
	currentPath,
	selectedPath,
	runId,
	projectId,
	isPinned,
	onOpenSelected,
	onTogglePinned,
}: FilesSelectionInspectorProps) {
	const inspectPath = selectedPath ?? currentPath
	const inspectStat = useFilesStat(runId, inspectPath, projectId)
	const inspectList = useFilesList(
		runId,
		inspectStat.data?.type === 'directory' ? inspectPath : null,
		projectId,
	)
	const inspectRead = useFilesRead(
		runId,
		inspectStat.data?.type === 'file' ? inspectPath : null,
		projectId,
	)
	const contentUrl = inspectPath
		? runId
			? buildContentUrl(buildWorkspaceUri(runId, inspectPath))
			: knowledgeContentUrl(inspectPath, { projectId })
		: ''
	const navigate = useNavigate()

	const viewer =
		inspectStat.data?.type === 'file'
			? resolveViewer(
					inspectPath ?? '',
					inspectRead.data?.contentType ?? inspectStat.data.mime_type ?? undefined,
				)
			: null

	if (!inspectPath) {
		return (
			<div className="space-y-3">
				<p className="text-sm font-medium text-foreground">Knowledge preview</p>
				<p className="text-sm text-muted-foreground">
					Select a file or folder to see preview and metadata.
				</p>
			</div>
		)
	}

	if (inspectStat.isLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner size="sm" />
				<span className="text-sm">Loading preview…</span>
			</div>
		)
	}

	if (inspectStat.isError || !inspectStat.data) {
		return <p className="text-sm text-destructive">Failed to load selection details.</p>
	}

	const title = getBaseName(
		inspectPath,
		inspectStat.data.type === 'directory' ? 'Directory' : 'File',
	)
	const actions = (
		<div className="flex items-center gap-1">
			<Button
				size="icon-xs"
				variant="ghost"
				onClick={() =>
					void navigate({
						to: '/chat',
						search: buildChatContextSearch({
							refType: inspectStat.data.type === 'directory' ? 'directory' : 'file',
							refId: inspectPath,
							path: inspectPath,
							runId,
							label: inspectPath,
						}),
					})
				}
				title="Ask in chat"
			>
				<ChatCircle size={14} />
			</Button>
			<Button
				size="icon-xs"
				variant="ghost"
				onClick={() => onOpenSelected(inspectPath, inspectStat.data.type)}
				title="Open selection"
			>
				<ArrowSquareOut size={14} />
			</Button>
			<Button
				size="icon-xs"
				variant={isPinned ? 'secondary' : 'ghost'}
				onClick={() => onTogglePinned(buildLocation(inspectPath, runId, inspectStat.data.type))}
				title={isPinned ? 'Unpin selection' : 'Pin selection'}
			>
				{isPinned ? <PushPinSlash size={14} /> : <PushPin size={14} />}
			</Button>
		</div>
	)

	let preview: React.ReactNode = null

	if (inspectStat.data.type === 'directory') {
		const entries = inspectList.data?.entries ?? []
		preview = (
			<div className="space-y-3 rounded-lg bg-muted/12 p-3">
				<div className="flex items-center gap-2">
					<Folder size={18} className="text-muted-foreground" />
					<span className="text-sm text-muted-foreground">Folder preview</span>
				</div>
				<KvList
					items={[
						{
							label: 'Entries',
							value: <span className="text-sm text-muted-foreground">{entries.length}</span>,
						},
						{
							label: 'Folders',
							value: (
								<span className="text-sm text-muted-foreground">
									{entries.filter((entry) => entry.type === 'directory').length}
								</span>
							),
						},
						{
							label: 'Files',
							value: (
								<span className="text-sm text-muted-foreground">
									{entries.filter((entry) => entry.type === 'file').length}
								</span>
							),
						},
					]}
				/>
			</div>
		)
	} else if (inspectRead.data && viewer) {
		preview = (
			<FilePreviewSurface
				path={inspectPath}
				contentUrl={contentUrl}
				viewerType={viewer.type}
				data={inspectRead.data}
				variant="inspector"
				fallback={
					<div className="rounded-lg bg-muted/12 p-3">
						<p className="text-sm text-muted-foreground">
							Preview not available for this file type.
						</p>
					</div>
				}
			/>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-xl font-semibold text-foreground">{title}</p>
					<p className="mt-1 break-all text-sm text-muted-foreground">{inspectPath}</p>
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Badge variant="outline">{runId ? 'run' : 'company'}</Badge>
						<Badge variant="outline">{inspectStat.data.type}</Badge>
						{inspectStat.data.writable ? <Badge variant="outline">editable</Badge> : null}
					</div>
				</div>
				{actions}
			</div>

			{preview}

			<KvList
				items={[
					{
						label: 'Scope',
						value: (
							<span className="text-sm text-muted-foreground">
								{runId ? `run:${runId.slice(0, 8)}` : 'company'}
							</span>
						),
					},
					{
						label: 'Type',
						value: <span className="text-sm text-muted-foreground">{inspectStat.data.type}</span>,
					},
					{
						label: 'Size',
						value: (
							<span className="text-sm text-muted-foreground">
								{formatBytes(inspectRead.data?.size ?? inspectStat.data.size)}
							</span>
						),
					},
					{
						label: 'MIME',
						value: (
							<span className="break-all text-sm text-muted-foreground">
								{inspectRead.data?.contentType ?? inspectStat.data.mime_type ?? '—'}
							</span>
						),
					},
					{
						label: 'Writable',
						value: (
							<span className="text-sm text-muted-foreground">
								{inspectStat.data.writable ? 'yes' : 'no'}
							</span>
						),
					},
					{
						label: 'ETag',
						value: (
							<span className="break-all text-sm text-muted-foreground">
								{inspectStat.data.etag ?? '—'}
							</span>
						),
					},
				]}
			/>
		</div>
	)
}
