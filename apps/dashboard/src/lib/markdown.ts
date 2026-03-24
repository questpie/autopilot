/**
 * Simple markdown → HTML renderer.
 * Handles: headings, bold, italic, code, links, lists, blockquotes, hr, code blocks.
 * No external deps — just regex transforms.
 */
export function renderMarkdown(text: string): string {
	// Escape HTML first (prevent XSS)
	let html = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

	// Code blocks (``` ... ```) — must be before other transforms
	html = html.replace(/```(\w*)\n([\s\S]*?)```/gm, (_m, _lang, code) => {
		return `<pre><code>${code.trim()}</code></pre>`
	})

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

	// Headings
	html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
	html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
	html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
	html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

	// Blockquotes
	html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

	// Horizontal rules
	html = html.replace(/^---$/gm, '<hr />')

	// Bold + italic
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
	html = html.replace(/_(.+?)_/g, '<em>$1</em>')

	// Links
	html = html.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener">$1</a>',
	)

	// Unordered lists (- item)
	html = html.replace(/^- (.+)$/gm, '<li>$1</li>')

	// Ordered lists (1. item)
	html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

	// Wrap consecutive <li> in <ul>
	html = html.replace(/((?:<li>.*<\/li>\n?)+)/gm, '<ul>$1</ul>')

	// Paragraphs — wrap remaining plain text lines
	html = html
		.split('\n\n')
		.map((block) => {
			const trimmed = block.trim()
			if (!trimmed) return ''
			// Skip blocks that are already wrapped in HTML tags
			if (/^<(h[1-6]|pre|ul|ol|blockquote|hr|div)/.test(trimmed)) return trimmed
			// Wrap in <p> and handle single newlines as <br>
			return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
		})
		.join('\n')

	return html
}

/** Prose classes for rendered markdown content */
export const PROSE_CLASSES = `prose prose-invert prose-sm max-w-none
	[&_h1]:font-mono [&_h1]:text-lg [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-4 [&_h1]:mb-2
	[&_h2]:font-mono [&_h2]:text-base [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-3 [&_h2]:mb-1.5
	[&_h3]:font-mono [&_h3]:text-sm [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:mt-2 [&_h3]:mb-1
	[&_p]:text-sm [&_p]:leading-[1.7] [&_p]:text-muted-foreground [&_p]:mb-2
	[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
	[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
	[&_li]:text-sm [&_li]:text-muted-foreground [&_li]:mb-0.5
	[&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-foreground
	[&_pre]:bg-secondary [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:overflow-x-auto [&_pre]:mb-2
	[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline
	[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
	[&_strong]:text-foreground [&_strong]:font-semibold
	[&_hr]:border-border [&_hr]:my-3`
