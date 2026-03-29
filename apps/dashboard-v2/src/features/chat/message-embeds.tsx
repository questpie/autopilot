import { ResourceLinker } from '@/components/resource-linker'
import { lazy, Suspense, useMemo } from 'react'
import { FileEmbeds, type FileAttachment } from './file-embed'

const SessionReplay = lazy(() => import('./session-replay').then((m) => ({ default: m.SessionReplay })))

interface MessageEmbedsProps {
	references: string[]
}

/** Extracts file attachments from references and renders file embeds, session replays, and resource links. */
export function MessageEmbedsSection({ references }: MessageEmbedsProps) {
	const fileAttachments = useMemo<FileAttachment[]>(() => {
		return references
			.filter((ref) => ref.includes('.') && !ref.startsWith('session-'))
			.map((ref) => ({ path: ref }))
	}, [references])

	const nonFileRefs = useMemo(() => {
		return references.filter((ref) => !(ref.includes('.') && !ref.startsWith('session-')))
	}, [references])

	return (
		<>
			{fileAttachments.length > 0 && (
				<FileEmbeds attachments={fileAttachments} />
			)}

			{nonFileRefs.length > 0 && (
				<div className="mt-1">
					{nonFileRefs.map((ref) => {
						if (ref.startsWith('session-')) {
							return (
								<Suspense key={ref} fallback={<div className="h-6 animate-pulse rounded bg-muted/20" />}>
									<SessionReplay sessionId={ref} />
								</Suspense>
							)
						}
						return <ResourceLinker key={ref} text={ref} className="text-xs" />
					})}
				</div>
			)}
		</>
	)
}
