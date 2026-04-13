import { useState } from 'react'
import {
  FileArrowUp,
  Globe,
  FileText,
  TestTube,
  Image,
  File,
  ArrowSquareOut,
  DownloadSimple,
} from '@phosphor-icons/react'
import type { Artifact, ArtifactKind } from '@/api/types'
import { getArtifactContentUrl } from '@/api/runs.api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── icon mapping ──────────────────────────────────────────────────────────────

function artifactIcon(kind: ArtifactKind) {
  switch (kind) {
    case 'changed_file':
      return FileArrowUp
    case 'preview_url':
      return Globe
    case 'doc':
    case 'diff_summary':
    case 'implementation_prompt':
    case 'validation_report':
      return FileText
    case 'test_report':
      return TestTube
    case 'preview_file':
      return Image
    case 'external_receipt':
      return ArrowSquareOut
    default:
      return File
  }
}

// ── inline content dialog ─────────────────────────────────────────────────────

interface InlineDialogProps {
  artifact: Artifact | null
  onClose: () => void
}

function InlineContentDialog({ artifact, onClose }: InlineDialogProps) {
  if (!artifact) return null

  return (
    <Dialog open={!!artifact} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-mono text-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs font-semibold">{artifact.title}</DialogTitle>
        </DialogHeader>
        <pre className="whitespace-pre-wrap break-words text-[11px] text-foreground mt-2">
          {artifact.ref_value || '(empty)'}
        </pre>
      </DialogContent>
    </Dialog>
  )
}

// ── single artifact card ──────────────────────────────────────────────────────

interface ArtifactCardProps {
  artifact: Artifact
  onInlineOpen: (artifact: Artifact) => void
}

function ArtifactCard({ artifact, onInlineOpen }: ArtifactCardProps) {
  const Icon = artifactIcon(artifact.kind)

  function handleClick() {
    if (artifact.ref_kind === 'url') {
      window.open(artifact.ref_value, '_blank', 'noopener,noreferrer')
    } else if (artifact.ref_kind === 'file') {
      const encoded = encodeURIComponent(artifact.ref_value)
      window.location.href = `/files?path=${encoded}&view=file`
    } else if (artifact.ref_kind === 'inline') {
      onInlineOpen(artifact)
    } else if (artifact.ref_kind === 'base64') {
      const url = getArtifactContentUrl(artifact.run_id, artifact.id)
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.title
      a.click()
    }
  }

  // Truncate ref_value for display
  const displayRef = artifact.ref_value
    ? artifact.ref_value.length > 60
      ? `…${artifact.ref_value.slice(-57)}`
      : artifact.ref_value
    : null

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left border border-border px-3 py-2 hover:bg-muted transition-colors cursor-pointer',
        'flex items-start gap-2.5',
      )}
    >
      <Icon size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-foreground truncate">{artifact.title}</span>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0 shrink-0">
            {artifact.kind}
          </span>
        </div>
        {displayRef && (
          <p className="font-mono text-[10px] text-muted-foreground/70 truncate mt-0.5">{displayRef}</p>
        )}
      </div>
      {artifact.ref_kind === 'url' && (
        <ArrowSquareOut size={12} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
      {artifact.ref_kind === 'base64' && (
        <DownloadSimple size={12} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
    </button>
  )
}

// ── public component ──────────────────────────────────────────────────────────

interface ArtifactListProps {
  artifacts: Artifact[]
}

export function ArtifactList({ artifacts }: ArtifactListProps) {
  const [inlineArtifact, setInlineArtifact] = useState<Artifact | null>(null)

  if (artifacts.length === 0) return null

  return (
    <>
      <div className="space-y-1">
        {artifacts.map((art) => (
          <ArtifactCard
            key={art.id}
            artifact={art}
            onInlineOpen={setInlineArtifact}
          />
        ))}
      </div>
      <InlineContentDialog
        artifact={inlineArtifact}
        onClose={() => setInlineArtifact(null)}
      />
    </>
  )
}
