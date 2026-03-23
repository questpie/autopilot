import { useState } from 'react'
import { API_URL } from '@/lib/api'

interface FileEntry {
	name: string
	type: 'file' | 'directory'
	path: string
}

interface FileTreeProps {
	basePath: string
	onSelect: (path: string) => void
	selectedPath?: string
}

function FileTreeNode({
	entry,
	onSelect,
	selectedPath,
}: {
	entry: FileEntry
	onSelect: (path: string) => void
	selectedPath?: string
}) {
	const [expanded, setExpanded] = useState(false)
	const [children, setChildren] = useState<FileEntry[]>([])
	const [loaded, setLoaded] = useState(false)

	const handleClick = async () => {
		if (entry.type === 'directory') {
			if (!loaded) {
				try {
					const res = await fetch(`${API_URL}/fs/${entry.path}`)
					const data = await res.json()
					setChildren(data.entries ?? [])
					setLoaded(true)
				} catch {
					setChildren([])
				}
			}
			setExpanded(!expanded)
		} else {
			onSelect(entry.path)
		}
	}

	const isSelected = selectedPath === entry.path

	return (
		<div>
			<button
				onClick={handleClick}
				className={`w-full text-left px-2 py-1 text-sm hover:bg-surface transition-colors flex items-center gap-1 ${
					isSelected ? 'text-purple bg-purple-faint' : 'text-muted'
				}`}
			>
				<span className="font-mono text-xs text-ghost w-4 shrink-0">
					{entry.type === 'directory' ? (expanded ? 'v' : '>') : ' '}
				</span>
				<span className="truncate">{entry.name}</span>
			</button>
			{expanded && children.length > 0 && (
				<div className="pl-3">
					{children.map((child) => (
						<FileTreeNode
							key={child.path}
							entry={child}
							onSelect={onSelect}
							selectedPath={selectedPath}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export function FileTree({ basePath, onSelect, selectedPath }: FileTreeProps) {
	const [entries, setEntries] = useState<FileEntry[]>([])
	const [loaded, setLoaded] = useState(false)

	if (!loaded) {
		fetch(`${API_URL}/fs/${basePath}`)
			.then((res) => res.json())
			.then((data) => {
				setEntries(data.entries ?? [])
				setLoaded(true)
			})
			.catch(() => setLoaded(true))
	}

	return (
		<div className="overflow-y-auto">
			{entries.map((entry) => (
				<FileTreeNode
					key={entry.path}
					entry={entry}
					onSelect={onSelect}
					selectedPath={selectedPath}
				/>
			))}
			{loaded && entries.length === 0 && (
				<p className="text-xs text-ghost px-2 py-4">No files found</p>
			)}
		</div>
	)
}
