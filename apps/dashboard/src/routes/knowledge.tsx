import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { API_URL } from '@/lib/api'
import { FileTree } from '@/components/FileTree'

export const Route = createFileRoute('/knowledge')({
	component: KnowledgePage,
})

function KnowledgePage() {
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(false)
	const [isMarkdown, setIsMarkdown] = useState(false)

	const handleSelect = async (path: string) => {
		setSelectedPath(path)
		setLoading(true)
		setIsMarkdown(path.endsWith('.md'))
		try {
			const res = await fetch(`${API_URL}/fs/${path}`)
			if (res.ok) {
				const text = await res.text()
				setContent(text)
			} else {
				setContent('Failed to load file.')
			}
		} catch {
			setContent('Error connecting to server.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="flex gap-4 h-full">
			{/* File Tree */}
			<div className="w-64 bg-card border border-border shrink-0 overflow-y-auto">
				<div className="p-3 border-b border-border">
					<h2 className="text-xs font-mono text-ghost uppercase tracking-wider">
						Knowledge Base
					</h2>
				</div>
				<FileTree basePath="" onSelect={handleSelect} selectedPath={selectedPath ?? undefined} />
			</div>

			{/* Content Viewer */}
			<div className="flex-1 bg-card border border-border overflow-y-auto">
				{!selectedPath && (
					<div className="flex items-center justify-center h-full">
						<p className="text-ghost text-sm">Select a file to view</p>
					</div>
				)}
				{selectedPath && loading && (
					<div className="flex items-center justify-center h-full">
						<p className="text-ghost text-sm">Loading...</p>
					</div>
				)}
				{selectedPath && !loading && (
					<div className="p-4">
						<div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
							<span className="text-xs font-mono text-muted">{selectedPath}</span>
							{isMarkdown && (
								<span className="text-xs font-mono text-purple">markdown</span>
							)}
						</div>
						{isMarkdown ? (
							<div
								className="prose-autopilot"
								dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
							/>
						) : (
							<pre className="text-sm font-mono text-muted whitespace-pre-wrap leading-relaxed">
								{content}
							</pre>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

/**
 * Minimal markdown to HTML converter.
 * Handles headings, bold, italic, code, links, lists, and paragraphs.
 */
function markdownToHtml(md: string): string {
	const lines = md.split('\n')
	let html = ''
	let inList = false
	let listType: 'ul' | 'ol' = 'ul'

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i]!

		// Close list if we're not in a list item
		if (inList && !/^(\s*[-*]\s|^\s*\d+\.\s)/.test(line)) {
			html += `</${listType}>`
			inList = false
		}

		// Headings
		if (line.startsWith('### ')) {
			html += `<h3>${inline(line.slice(4))}</h3>`
		} else if (line.startsWith('## ')) {
			html += `<h2>${inline(line.slice(3))}</h2>`
		} else if (line.startsWith('# ')) {
			html += `<h1>${inline(line.slice(2))}</h1>`
		}
		// Unordered list
		else if (/^\s*[-*]\s/.test(line)) {
			if (!inList) {
				listType = 'ul'
				html += '<ul>'
				inList = true
			}
			html += `<li>${inline(line.replace(/^\s*[-*]\s/, ''))}</li>`
		}
		// Ordered list
		else if (/^\s*\d+\.\s/.test(line)) {
			if (!inList) {
				listType = 'ol'
				html += '<ol>'
				inList = true
			}
			html += `<li>${inline(line.replace(/^\s*\d+\.\s/, ''))}</li>`
		}
		// Empty line
		else if (line.trim() === '') {
			// skip
		}
		// Paragraph
		else {
			html += `<p>${inline(line)}</p>`
		}
	}

	if (inList) {
		html += `</${listType}>`
	}

	return html
}

function inline(text: string): string {
	return text
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}
