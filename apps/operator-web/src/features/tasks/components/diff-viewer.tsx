// ── DiffViewer ────────────────────────────────────────────────────────────────
// Pure renderer for unified diff text.
// Takes a `diff` string prop and renders it with syntax-highlighted lines,
// old/new line number gutters, and appropriate background tints.

interface DiffLine {
	type: 'add' | 'del' | 'hunk' | 'file' | 'context' | 'no-newline'
	content: string
	oldNum: number | null
	newNum: number | null
}

function parseDiff(diff: string): DiffLine[] {
	const lines = diff.split('\n')
	// Strip trailing empty line produced by split when diff ends with \n
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop()
	}

	const result: DiffLine[] = []
	let oldNum = 0
	let newNum = 0

	for (const raw of lines) {
		if (raw.startsWith('@@')) {
			// Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
			const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
			if (match) {
				oldNum = Number.parseInt(match[1], 10)
				newNum = Number.parseInt(match[2], 10)
			}
			result.push({ type: 'hunk', content: raw, oldNum: null, newNum: null })
		} else if (raw.startsWith('--- ') || raw.startsWith('+++ ')) {
			result.push({ type: 'file', content: raw, oldNum: null, newNum: null })
		} else if (
			raw.startsWith('diff ') ||
			raw.startsWith('index ') ||
			raw.startsWith('new file') ||
			raw.startsWith('deleted file') ||
			raw.startsWith('Binary ')
		) {
			result.push({ type: 'file', content: raw, oldNum: null, newNum: null })
		} else if (raw === '\\ No newline at end of file') {
			result.push({ type: 'no-newline', content: raw, oldNum: null, newNum: null })
		} else if (raw.startsWith('+')) {
			result.push({ type: 'add', content: raw, oldNum: null, newNum: newNum })
			newNum++
		} else if (raw.startsWith('-')) {
			result.push({ type: 'del', content: raw, oldNum: oldNum, newNum: null })
			oldNum++
		} else {
			// Context line (starts with space or is blank inside the diff body)
			result.push({ type: 'context', content: raw, oldNum: oldNum, newNum: newNum })
			oldNum++
			newNum++
		}
	}

	return result
}

function lineClass(type: DiffLine['type']): string {
	switch (type) {
		case 'add':
			return 'bg-success-surface text-foreground'
		case 'del':
			return 'bg-destructive-surface text-foreground'
		case 'hunk':
			return 'bg-info-surface text-info-muted'
		case 'file':
			return 'bg-muted text-muted-foreground'
		case 'no-newline':
			return 'bg-muted text-muted-foreground italic'
		default:
			return 'text-foreground'
	}
}

function gutterClass(type: DiffLine['type']): string {
	switch (type) {
		case 'add':
			return 'text-success-muted'
		case 'del':
			return 'text-destructive-muted'
		case 'hunk':
		case 'file':
			return 'text-muted-foreground/50'
		default:
			return 'text-muted-foreground/50'
	}
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DiffViewerProps {
	diff: string
}

	export function DiffViewer({ diff }: DiffViewerProps) {
		if (!diff || diff.trim() === '') {
			return <div className="px-3 py-4 font-mono text-[12px] text-muted-foreground">(empty diff)</div>
		}

	const lines = parseDiff(diff)

		return (
			<div className="overflow-auto scrollbar-thin">
				<table className="w-full border-collapse font-mono text-[12px] leading-5">
				<tbody>
					{lines.map((line, i) => {
						const isGutter =
							line.type !== 'hunk' && line.type !== 'file' && line.type !== 'no-newline'
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable identity
							<tr key={i} className={lineClass(line.type)}>
								<td
									className={`select-none text-right px-2 py-0 w-10 border-r border-border/40 ${gutterClass(line.type)}`}
								>
									{isGutter ? (line.oldNum ?? '') : ''}
								</td>
								<td
									className={`select-none text-right px-2 py-0 w-10 border-r border-border/40 ${gutterClass(line.type)}`}
								>
									{isGutter ? (line.newNum ?? '') : ''}
								</td>
								<td className="px-3 py-0 whitespace-pre">{line.content}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
