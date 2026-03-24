function highlightCode(code: string, lang?: string): string {
	// Escape HTML first
	const escaped = code
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

	// Tokenize: protect strings first, then highlight the rest
	const tokens: Array<{ type: 'string' | 'raw'; value: string }> = []
	let remaining = escaped

	// Extract all double-quoted and single-quoted strings
	const stringRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
	let lastIndex = 0
	let match: RegExpExecArray | null = stringRegex.exec(remaining)

	while (match !== null) {
		if (match.index > lastIndex) {
			tokens.push({ type: 'raw', value: remaining.slice(lastIndex, match.index) })
		}
		tokens.push({ type: 'string', value: match[0] })
		lastIndex = match.index + match[0].length
		match = stringRegex.exec(remaining)
	}
	if (lastIndex < remaining.length) {
		tokens.push({ type: 'raw', value: remaining.slice(lastIndex) })
	}

	// Process each token
	return tokens.map(token => {
		if (token.type === 'string') {
			return `<span style="color: var(--syntax-string)">${token.value}</span>`
		}

		let html = token.value

		// Comments: # at start of line only
		html = html.replace(
			/^(\s*#[^\n]*)/gm,
			'<span style="color: var(--syntax-comment)">$1</span>',
		)

		// Comments: // only when preceded by whitespace or start of line (not in URLs)
		html = html.replace(
			/(^|\s)(\/\/[^\n]*)/gm,
			'$1<span style="color: var(--syntax-comment)">$2</span>',
		)

		// YAML keys
		if (lang === 'yaml' || lang === 'shell' || !lang) {
			html = html.replace(
				/^(\s*[\w_-]+):/gm,
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

		// Shell prompt
		html = html.replace(
			/^(\$\s)/gm,
			'<span style="color: var(--syntax-keyword)">$1</span>',
		)

		// Numbers (not inside words)
		html = html.replace(
			/(?<![a-zA-Z_-])(\d+)(?![a-zA-Z_])/g,
			'<span style="color: var(--syntax-number)">$1</span>',
		)

		// Arrows
		html = html.replace(
			/(-&gt;|\u2192)/g,
			'<span style="color: var(--syntax-punctuation)">$1</span>',
		)

		return html
	}).join('')
}

function detectLang(title?: string): string | undefined {
	if (!title) return undefined
	const t = title.toLowerCase()
	if (t.includes('.tsx') || t.includes('.ts')) return 'tsx'
	if (t.includes('.js') || t.includes('.jsx')) return 'js'
	if (t.includes('.yaml') || t.includes('.yml')) return 'yaml'
	if (t.includes('terminal') || t.includes('cli') || t.includes('install') || t.includes('filter')) return 'shell'
	if (t.includes('what agents')) return 'tsx'
	if (t.includes('/') || t.includes('company') || t.includes('memory')) return 'yaml'
	return 'yaml'
}

export function CodeBlock({
	children,
	title,
}: { children: React.ReactNode; title?: string }) {
	const lang = detectLang(title)
	const raw = typeof children === 'string' ? children : ''
	const highlighted = raw ? highlightCode(raw, lang) : ''

	return (
		<div className="bg-lp-bg overflow-hidden flex flex-col h-full">
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
