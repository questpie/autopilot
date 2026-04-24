import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useFilesPreferences } from '@/hooks/use-files-preferences'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { type SavedFilesLocation, getBaseName, getParentPath } from '../lib/file-paths'
import { DirectoryListing } from './directory-listing'
import { FileView } from './file-view'

export function FilesScreen() {
	useSetLayoutMode('immersive')
	const search = useSearch({ from: '/_authed/files' })
	const path = search.path ?? null
	const runId = search.runId ?? null
	const projectId = search.projectId ?? null
	const view = search.view ?? null
	const selectedPath = search.selected ?? null
	const filesPreferences = useFilesPreferences()

	const navigate = useNavigate()

	const currentView = view === 'file' && path ? 'file' : 'browser'
	const currentPath = currentView === 'file' ? getParentPath(path) : path
	const activeSelectedPath = currentView === 'file' ? path : selectedPath

	function remember(location: SavedFilesLocation) {
		filesPreferences.addRecent(location)
	}

	function handleNavigate(nextPath: string | null, type: 'file' | 'directory') {
		if (type === 'file') {
			remember({
				path: nextPath,
				runId,
				type,
				label: getBaseName(nextPath, 'File'),
				viewedAt: new Date().toISOString(),
			})
			void navigate({
				to: '/files',
				search: {
					runId: runId ?? undefined,
					projectId: projectId ?? undefined,
					path: nextPath ?? undefined,
					view: 'file',
				},
			})
		} else {
			remember({
				path: nextPath,
				runId,
				type,
				label: getBaseName(nextPath, runId ? 'Run workspace' : 'Company'),
				viewedAt: new Date().toISOString(),
			})
			void navigate({
				to: '/files',
				search: {
					runId: runId ?? undefined,
					projectId: projectId ?? undefined,
					path: nextPath ?? undefined,
				},
			})
		}
	}

	function handleBack(parentPath: string | null) {
		void navigate({
			to: '/files',
			search: {
				runId: runId ?? undefined,
				projectId: projectId ?? undefined,
				path: parentPath ?? undefined,
				selected: path ?? undefined,
			},
		})
	}

	function handleSelectItem(nextPath: string) {
		void navigate({
			to: '/files',
			search: {
				runId: runId ?? undefined,
				projectId: projectId ?? undefined,
				path: currentPath ?? undefined,
				selected: nextPath,
			},
		})
	}

	function handleTogglePinned(location: SavedFilesLocation) {
		filesPreferences.togglePinned(location)
	}

	return (
		<div className="h-full min-h-0">
			{currentView === 'file' && path ? (
				<FileView
					path={path}
					runId={runId}
					projectId={projectId}
					onBack={handleBack}
					onOpenFile={(nextPath) => handleNavigate(nextPath, 'file')}
				/>
			) : (
				<DirectoryListing
					path={currentPath}
					runId={runId}
					projectId={projectId}
					selectedPath={activeSelectedPath}
					isSelectionPinned={
						activeSelectedPath
							? filesPreferences.isPinned({
									path: activeSelectedPath,
									runId,
									type: 'file',
								}) ||
								filesPreferences.isPinned({
									path: activeSelectedPath,
									runId,
									type: 'directory',
								})
							: filesPreferences.isPinned({
									path: currentPath,
									runId,
									type: 'directory',
								})
					}
					onTogglePinned={handleTogglePinned}
					onSelectItem={handleSelectItem}
					onOpenItem={handleNavigate}
				/>
			)}
		</div>
	)
}
