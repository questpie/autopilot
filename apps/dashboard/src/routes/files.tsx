import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { FileTree } from '@/components/knowledge/file-tree'
import { FileViewer } from '@/components/knowledge/file-viewer'
import { SearchBar } from '@/components/knowledge/search-bar'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateFile, useUploadFile } from '@/hooks/use-files'

export const Route = createFileRoute('/files')({
	component: FilesPage,
	validateSearch: (search: Record<string, unknown>) => ({
		file: (search.file as string) ?? undefined,
	}),
})

function FilesPage() {
	const { file: fileFromSearch } = useSearch({ from: '/files' })
	const navigate = useNavigate()
	const [selectedPath, setSelectedPath] = useState<string | undefined>(fileFromSearch)
	const [search, setSearch] = useState('')
	const [showNewDoc, setShowNewDoc] = useState(false)
	const [showUpload, setShowUpload] = useState(false)

	useEffect(() => {
		if (fileFromSearch && fileFromSearch !== selectedPath) {
			setSelectedPath(fileFromSearch)
		}
	}, [fileFromSearch])

	const handleSelect = (path: string) => {
		setSelectedPath(path)
		navigate({ to: '/files', search: { file: path }, replace: true })
	}

	const breadcrumb = selectedPath
		? selectedPath.split('/').filter(Boolean).join(' / ')
		: undefined

	return (
		<ErrorBoundary>
			<TopBar title="Files">
				<div className="flex items-center gap-2">
					{breadcrumb && (
						<span className="font-mono text-[10px] text-muted-foreground truncate max-w-[400px]">
							{breadcrumb}
						</span>
					)}
					<Button size="sm" variant="outline" onClick={() => setShowNewDoc(true)}>
						New Document
					</Button>
					<Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
						Upload
					</Button>
				</div>
			</TopBar>
			<div className="flex flex-1 overflow-hidden">
				{/* File Tree */}
				<div className="w-[280px] border-r border-border overflow-y-auto shrink-0">
					<SearchBar value={search} onChange={setSearch} />
					<FileTree
						basePath=""
						selectedPath={selectedPath}
						onSelect={handleSelect}
					/>
				</div>

				{/* Content Viewer */}
				<div className="flex-1 overflow-y-auto">
					<FileViewer path={selectedPath} />
				</div>
			</div>

			{showNewDoc && (
				<NewDocumentDialog
					currentDir={selectedPath?.includes('/') ? selectedPath.split('/').slice(0, -1).join('/') : ''}
					onClose={() => setShowNewDoc(false)}
				/>
			)}

			{showUpload && (
				<UploadDialog
					currentDir={selectedPath?.includes('/') ? selectedPath.split('/').slice(0, -1).join('/') : ''}
					onClose={() => setShowUpload(false)}
				/>
			)}
		</ErrorBoundary>
	)
}

function NewDocumentDialog({ currentDir, onClose }: { currentDir: string; onClose: () => void }) {
	const [path, setPath] = useState(currentDir ? `${currentDir}/new-doc.md` : 'knowledge/new-doc.md')
	const [content, setContent] = useState('')
	const createFile = useCreateFile()

	const handleSubmit = () => {
		if (!path.trim()) return
		createFile.mutate(
			{ path: path.trim(), content },
			{ onSuccess: () => onClose() },
		)
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border p-6">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-4">New Document</h2>
				<div className="space-y-4">
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Path
						</label>
						<Input
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="knowledge/technical/new-doc.md"
						/>
					</div>
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Content
						</label>
						<Textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Write markdown content..."
							rows={12}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>Cancel</Button>
						<Button onClick={handleSubmit} disabled={!path.trim() || createFile.isPending}>
							{createFile.isPending ? 'Creating...' : 'Create'}
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}

function UploadDialog({ currentDir, onClose }: { currentDir: string; onClose: () => void }) {
	const [targetDir, setTargetDir] = useState(currentDir || 'knowledge')
	const uploadFile = useUploadFile()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const handleUpload = useCallback(
		(file: File) => {
			uploadFile.mutate(
				{ file, targetDir },
				{ onSuccess: () => onClose() },
			)
		},
		[targetDir, uploadFile, onClose],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(false)
			const file = e.dataTransfer.files[0]
			if (file) handleUpload(file)
		},
		[handleUpload],
	)

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border p-6">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-4">Upload File</h2>
				<div className="space-y-4">
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Target Directory
						</label>
						<Input
							value={targetDir}
							onChange={(e) => setTargetDir(e.target.value)}
							placeholder="knowledge"
						/>
					</div>
					<div
						onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
						onDragLeave={() => setIsDragging(false)}
						onDrop={handleDrop}
						onClick={() => fileInputRef.current?.click()}
						className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
							isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
						}`}
					>
						<div className="text-sm text-muted-foreground">
							Drop files here or click to browse
						</div>
						<input
							ref={fileInputRef}
							type="file"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0]
								if (file) handleUpload(file)
							}}
						/>
					</div>
					{uploadFile.isPending && (
						<div className="font-mono text-[11px] text-info">Uploading...</div>
					)}
					<div className="flex justify-end">
						<Button variant="outline" onClick={onClose}>Cancel</Button>
					</div>
				</div>
			</div>
		</>
	)
}
