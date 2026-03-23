import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import { renderMarkdown, PROSE_CLASSES } from '@/lib/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/empty-state'

interface MarkdownViewerProps {
	path?: string
}

export function MarkdownViewer({ path }: MarkdownViewerProps) {
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
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		)
	}

	if (isError || content === undefined) {
		return <EmptyState icon={'\u26A0'} title="Failed to load file" />
	}

	const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
	const isMarkdown = path.endsWith('.md')

	if (isMarkdown) {
		return (
			<div className="p-8 max-w-[720px]">
				<div
					className={PROSE_CLASSES + ' [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-base'}
					dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
				/>
			</div>
		)
	}

	// YAML, JSON, or other text files — syntax-highlighted code block
	return (
		<div className="p-8 max-w-[720px]">
			<pre className="font-mono text-[13px] bg-secondary border border-border p-4 overflow-x-auto whitespace-pre-wrap text-foreground">
				{text}
			</pre>
		</div>
	)
}
