import { useNavigate, useSearch } from '@tanstack/react-router'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useFilesPreferences } from '@/hooks/use-files-preferences'
import { getParentPath, getBaseName, type FilesLayout, type SavedFilesLocation } from '../lib/file-paths'
import { DirectoryListing } from './directory-listing'
import { FileView } from './file-view'

function resolveLayout(value: unknown, fallback: FilesLayout): FilesLayout {
  return value === 'list' || value === 'grid' || value === 'columns' || value === 'preview'
    ? value
    : fallback
}

export function FilesScreen() {
  useSetLayoutMode('immersive')
  const search = useSearch({ from: '/_authed/files' })
  const path = search.path ?? null
  const runId = search.runId ?? null
  const view = search.view ?? null
  const selectedPath = search.selected ?? null
  const filesPreferences = useFilesPreferences()
  const layout = resolveLayout(search.layout, filesPreferences.layout as FilesLayout)

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
        search: { runId: runId ?? undefined, path: nextPath ?? undefined, view: 'file', layout },
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
        search: { runId: runId ?? undefined, path: nextPath ?? undefined, layout },
      })
    }
  }

  function handleBack(parentPath: string | null) {
    void navigate({
      to: '/files',
      search: { runId: runId ?? undefined, path: parentPath ?? undefined, selected: path ?? undefined, layout },
    })
  }

  function handleLayoutChange(nextLayout: 'list' | 'grid' | 'columns' | 'preview') {
    filesPreferences.saveLayout(nextLayout)
    void navigate({
      to: '/files',
      search: {
        runId: runId ?? undefined,
        path: currentPath ?? undefined,
        view: view ?? undefined,
        selected: currentView === 'browser' ? activeSelectedPath ?? undefined : undefined,
        layout: nextLayout,
      },
    })
  }

  function handleSelectItem(nextPath: string) {
    void navigate({
      to: '/files',
      search: {
        runId: runId ?? undefined,
        path: currentPath ?? undefined,
        selected: nextPath,
        layout,
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
          onBack={handleBack}
        />
      ) : (
        <DirectoryListing
          path={currentPath}
          runId={runId}
          layout={layout}
          selectedPath={activeSelectedPath}
          isSelectionPinned={
            activeSelectedPath
              ? filesPreferences.isPinned({
                  path: activeSelectedPath,
                  runId,
                  type: 'file',
                }) || filesPreferences.isPinned({
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
          onLayoutChange={handleLayoutChange}
          onSelectItem={handleSelectItem}
          onOpenItem={handleNavigate}
        />
      )}
    </div>
  )
}
