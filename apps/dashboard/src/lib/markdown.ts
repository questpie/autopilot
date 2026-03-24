import { Marked } from 'marked'
import { linkifyHtml } from './link-patterns'

const marked = new Marked({
	gfm: true,
	breaks: true,
	renderer: {
		// Open external links in new tab, leave internal links alone
		link({ href, text }) {
			const isInternal = href.startsWith('/') || href.includes('data-internal')
			if (isInternal) {
				return `<a href="${href}">${text}</a>`
			}
			return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`
		},
		// Linkify internal references in plain text nodes
		text({ text }) {
			return linkifyHtml(text)
		},
	},
})

export function renderMarkdown(text: string): string {
	return marked.parse(text) as string
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
