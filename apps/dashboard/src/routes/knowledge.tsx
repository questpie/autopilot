import { createFileRoute, Navigate, useSearch } from '@tanstack/react-router'

export const Route = createFileRoute('/knowledge')({
	component: KnowledgeRedirect,
	validateSearch: (search: Record<string, unknown>) => ({
		file: (search.file as string) ?? undefined,
	}),
})

/** Backwards-compatible redirect: /knowledge -> /files */
function KnowledgeRedirect() {
	const { file } = useSearch({ from: '/knowledge' })
	return <Navigate to="/files" search={file ? { file } : {}} replace />
}
