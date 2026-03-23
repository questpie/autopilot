import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import { renderMarkdown, PROSE_CLASSES } from '@/lib/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSaveFile } from '@/hooks/use-files'

interface FileViewerProps {
	path?: string
}

export function FileViewer({ path }: FileViewerProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [editContent, setEditContent] = useState('')
	const saveFile = useSaveFile()

	const { data: content, isLoading, isError } = useQuery({
		queryKey: queryKeys.file(path ?? ''),
		queryFn: () => apiFetch<string>(`/fs/${path}`),
		enabled: !!path,
	})

	if (!path) {
		return (
			<EmptyState
				title="Select a file"
				description="Choose a file from the tree to view its content"
			/>
		)
	}

	if (isLoading) {
		return (
			<div className="p-8 space-y-4">
				<Skeleton className="h-8 w-1/2" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</div>
		)
	}

	if (isError || content === undefined) {
		return <EmptyState icon={'\u26A0'} title="Failed to load file" />
	}

	const ext = path.split('.').pop()?.toLowerCase() ?? ''
	const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)
	const isMarkdown = ext === 'md'
	const isJson = ext === 'json'

	const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)

	const startEdit = () => {
		setEditContent(text)
		setIsEditing(true)
	}

	const handleSave = () => {
		saveFile.mutate(
			{ path, content: editContent },
			{
				onSuccess: () => setIsEditing(false),
			},
		)
	}

	if (isImage) {
		return (
			<div className="p-8">
				<img
					src={`http://localhost:7778/fs/${path}`}
					alt={path}
					className="max-w-full max-h-[600px] object-contain"
				/>
			</div>
		)
	}

	if (isEditing) {
		return (
			<div className="p-8 max-w-[720px] space-y-4">
				<div className="flex items-center justify-between">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
						Editing
					</span>
					<div className="flex gap-2">
						<Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
							Cancel
						</Button>
						<Button size="sm" onClick={handleSave} disabled={saveFile.isPending}>
							{saveFile.isPending ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</div>
				<Textarea
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
					className="font-mono text-[13px] min-h-[500px]"
				/>
			</div>
		)
	}

	return (
		<div className="p-8 max-w-[720px]">
			<div className="flex justify-end mb-4">
				<Button size="sm" variant="outline" onClick={startEdit}>
					Edit
				</Button>
			</div>
			{isMarkdown ? (
				<div
					className={PROSE_CLASSES + ' [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-base'}
					dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
				/>
			) : isJson ? (
				<pre className="font-mono text-[13px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
					{(() => {
						try {
							return JSON.stringify(JSON.parse(text), null, 2)
						} catch {
							return text
						}
					})()}
				</pre>
			) : (
				<pre className="font-mono text-[13px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
					{text}
				</pre>
			)}
		</div>
	)
}
