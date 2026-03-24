function highlightCode(code: string, lang?: string): string {
	let html = code
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

	// Comments
	html = html.replace(
		/(#[^\n]*)/g,
		'<span style="color: var(--syntax-comment)">$1</span>',
	)
	html = html.replace(
		/(\/\/[^\n]*)/g,
		'<span style="color: var(--syntax-comment)">$1</span>',
	)

	// Strings
	html = html.replace(
		/"([^"\\]*(?:\\.[^"\\]*)*)"/g,
		'"<span style="color: var(--syntax-string)">$1</span>"',
	)
	html = html.replace(
		/'([^'\\]*(?:\\.[^'\\]*)*)'/g,
		"'<span style=\"color: var(--syntax-string)\">$1</span>'",
	)

	// YAML/config keys
	if (lang === 'yaml' || lang === 'install' || lang === 'shell' || !lang) {
		html = html.replace(
			/^(\s*[\w-]+):/gm,
			'<span style="color: var(--syntax-keyword)">$1</span>:',
		)
	}

	// JS/TS keywords
	if (lang === 'js' || lang === 'ts' || lang === 'tsx') {
		html = html.replace(
			/\b(const|let|var|function|export|default|import|from|return|if|else|new|typeof|async|await)\b/g,
			'<span style="color: var(--syntax-keyword)">$1</span>',
		)
		html = html.replace(
			/\b(true|false|null|undefined)\b/g,
			'<span style="color: var(--syntax-number)">$1</span>',
		)
	}

	// Shell commands (lines starting with $)
	html = html.replace(
		/^(\$\s)/gm,
		'<span style="color: var(--syntax-keyword)">$1</span>',
	)

	// Numbers
	html = html.replace(
		/\b(\d+)\b/g,
		'<span style="color: var(--syntax-number)">$1</span>',
	)

	// Arrows
	html = html.replace(
		/(-&gt;|\u2192)/g,
		'<span style="color: var(--syntax-punctuation)">$1</span>',
	)

	return html
}

function detectLang(title?: string): string | undefined {
	if (!title) return undefined
	const t = title.toLowerCase()
	if (t.includes('.tsx') || t.includes('.ts')) return 'tsx'
	if (t.includes('.js') || t.includes('.jsx')) return 'js'
	if (t.includes('.yaml') || t.includes('.yml')) return 'yaml'
	if (
		t.includes('terminal')
		|| t.includes('cli')
		|| t.includes('install')
		|| t.includes('filter')
	) return 'shell'
	return undefined
}

export function CodeBlock({
	children,
	title,
}: { children: React.ReactNode; title?: string }) {
	const lang = detectLang(title)
	const raw = typeof children === 'string' ? children : ''
	const highlighted = raw ? highlightCode(raw, lang) : ''

	return (
		<div className="bg-lp-bg border border-lp-border overflow-hidden flex flex-col h-full">
			{title && (
				<div className="px-4 py-2 border-b border-lp-border flex items-center gap-2">
					<div className="flex gap-1">
						<div className="w-2 h-2 bg-lp-accent-red" />
						<div className="w-2 h-2 bg-lp-accent-yellow" />
						<div className="w-2 h-2 bg-lp-accent-green" />
					</div>
					<span className="font-mono text-[11px] text-lp-ghost">{title}</span>
				</div>
			)}
			{raw ? (
				<pre
					className="font-mono text-xs text-lp-fg p-4 m-0 overflow-x-auto leading-relaxed flex-1 lp-scrollbar"
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			) : (
				<pre className="font-mono text-xs text-lp-fg p-4 m-0 overflow-x-auto leading-relaxed flex-1 lp-scrollbar">
					{children}
				</pre>
			)}
		</div>
	)
}
