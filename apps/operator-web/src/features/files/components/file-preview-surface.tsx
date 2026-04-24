import type { VfsReadResult } from '@/api/vfs.api'
import { Markdown } from '@/components/ui/markdown'
import { Spinner } from '@/components/ui/spinner'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { splitMarkdownDocument } from '@/lib/markdown-document'
import { cn } from '@/lib/utils'
import type { ViewerType } from '@/lib/viewer-registry'
import { useEffect, useState } from 'react'

type FilePreviewVariant = 'full' | 'inspector' | 'card'

interface FilePreviewSurfaceProps {
	path: string
	contentUrl: string
	viewerType: ViewerType
	data?: VfsReadResult | null
	variant: FilePreviewVariant
	fallback?: React.ReactNode
}

function useDocxPreview(contentUrl: string, enabled: boolean) {
	const [html, setHtml] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!enabled) {
			setHtml('')
			setLoading(false)
			setError(null)
			return
		}

		let cancelled = false

		void (async () => {
			try {
				setLoading(true)
				setError(null)
				const res = await fetch(contentUrl, { credentials: 'include' })
				if (!res.ok) throw new Error(`Failed to fetch DOCX: ${res.status}`)

				const mammoth = await import('mammoth')
				const result = await mammoth.convertToHtml({ arrayBuffer: await res.arrayBuffer() })

				if (cancelled) return
				setHtml(result.value)
			} catch (err) {
				if (!cancelled)
					setError(err instanceof Error ? err.message : 'Failed to render DOCX preview')
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [contentUrl, enabled])

	return { html, loading, error }
}

export function FilePreviewSurface({
	path,
	contentUrl,
	viewerType,
	data,
	variant,
	fallback = null,
}: FilePreviewSurfaceProps) {
	const docx = useDocxPreview(contentUrl, viewerType === 'docx' && variant !== 'card')
	const markdownDocument =
		viewerType === 'markdown' && data?.content ? splitMarkdownDocument(data.content) : null

	if (viewerType === 'image') {
		if (variant === 'card') {
			return <img src={contentUrl} alt={path} className="h-full w-full object-cover" />
		}

		if (variant === 'inspector') {
			return (
				<img
					src={contentUrl}
					alt={path}
					className="max-w-full rounded-md outline outline-1 outline-black/10 dark:outline-white/10"
				/>
			)
		}

		return (
			<div className="flex h-full items-center justify-center overflow-auto p-6">
				<img
					src={contentUrl}
					alt={path}
					className="max-w-full outline outline-1 outline-black/10 dark:outline-white/10"
				/>
			</div>
		)
	}

	if (viewerType === 'pdf') {
		if (variant === 'card') {
			return (
				<iframe
					src={`${contentUrl}#toolbar=0&navpanes=0&scrollbar=0`}
					title={path}
					className="pointer-events-none h-full w-full bg-white"
				/>
			)
		}

		if (variant === 'inspector') {
			return (
				<iframe src={contentUrl} title={path} className="h-80 w-full rounded-md bg-background" />
			)
		}

		return <iframe src={contentUrl} title={path} className="h-full w-full bg-background" />
	}

	if (viewerType === 'video') {
		if (variant === 'card') {
			return (
				<video src={contentUrl} muted preload="metadata" className="h-full w-full object-cover" />
			)
		}

		if (variant === 'inspector') {
			return (
				// biome-ignore lint/a11y/useMediaCaption: User-uploaded video files do not provide caption tracks.
				<video
					src={contentUrl}
					controls
					playsInline
					className="max-h-80 w-full rounded-md bg-black"
				/>
			)
		}

		return (
			<div className="flex h-full items-center justify-center overflow-auto p-6">
				{/* biome-ignore lint/a11y/useMediaCaption: User-uploaded video files do not provide caption tracks. */}
				<video src={contentUrl} controls playsInline className="max-h-full max-w-full bg-black" />
			</div>
		)
	}

	if (viewerType === 'docx') {
		if (variant === 'card') return fallback
		if (docx.loading) {
			return (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Spinner size="sm" />
					<span className="text-sm">Rendering DOCX…</span>
				</div>
			)
		}
		if (docx.error) {
			return variant === 'full' ? (
				<div className={cn(surfaceCardVariants({ size: 'md' }), 'max-w-lg')}>
					<p className="text-sm text-destructive">{docx.error}</p>
				</div>
			) : (
				<p className="text-sm text-destructive">{docx.error}</p>
			)
		}

		if (variant === 'inspector') {
			return (
				<div className="prose prose-sm max-h-80 overflow-auto rounded-lg bg-muted/12 p-3 dark:prose-invert">
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Mammoth returns HTML for local DOCX previews. */}
					<div dangerouslySetInnerHTML={{ __html: docx.html }} />
				</div>
			)
		}

		return (
			<div className="h-full overflow-auto">
				<div className="prose prose-sm mx-auto max-w-4xl px-6 py-6 dark:prose-invert">
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Mammoth returns HTML for local DOCX previews. */}
					<div dangerouslySetInnerHTML={{ __html: docx.html }} />
				</div>
			</div>
		)
	}

	if (viewerType === 'markdown' && data?.content) {
		if (variant === 'card') return fallback
		if (variant === 'inspector') {
			return (
				<div className="max-h-80 overflow-auto rounded-lg bg-muted/12 p-3">
					{markdownDocument?.frontmatterBlock ? (
						<pre className="mb-3 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
							{markdownDocument.frontmatterBlock.trimEnd()}
						</pre>
					) : null}
					<Markdown content={markdownDocument?.body ?? data.content} />
				</div>
			)
		}

		return (
			<div className="h-full overflow-auto">
				<div className="mx-auto max-w-3xl px-6 py-6">
					{markdownDocument?.frontmatterBlock ? (
						<pre className="mb-4 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-1 px-4 py-3 font-mono text-xs leading-5 text-muted-foreground">
							{markdownDocument.frontmatterBlock.trimEnd()}
						</pre>
					) : null}
					<Markdown content={markdownDocument?.body ?? data.content} />
				</div>
			</div>
		)
	}

	if (
		data?.isText &&
		(viewerType === 'plain' || viewerType === 'structured' || viewerType === 'code')
	) {
		const text = data.content.slice(0, variant === 'full' ? 8000 : 2400)
		if (variant === 'card') return fallback
		if (variant === 'inspector') {
			return (
				<div className="max-h-80 overflow-auto rounded-lg bg-muted/12 p-3">
					<pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
						{text}
					</pre>
				</div>
			)
		}
		return (
			<div className="h-full overflow-auto p-6">
				<pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{text}</pre>
			</div>
		)
	}

	return <>{fallback}</>
}
