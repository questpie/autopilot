/**
 * Registry-based knowledge resource viewer resolution.
 * Pattern: extension/mime → viewer type.
 * Shared renderer registry for Knowledge resources and project run inspection.
 */

export type ViewerType =
	| 'markdown'
	| 'image'
	| 'openapi'
	| 'pdf'
	| 'video'
	| 'docx'
	| 'structured'
	| 'code'
	| 'plain'

export interface ViewerRegistration {
	test: (path: string, mime?: string) => boolean
	type: ViewerType
	label: string
	priority: number
}

function ext(path: string): string {
	const lastDot = path.lastIndexOf('.')
	const lastSlash = path.lastIndexOf('/')
	if (lastDot === -1 || lastDot < lastSlash) return ''
	return path.slice(lastDot + 1).toLowerCase()
}

function hasMime(mime: string | undefined, prefix: string): boolean {
	return !!mime && mime.toLowerCase().startsWith(prefix)
}

function isOpenApi(path: string, mime?: string): boolean {
	const lowerPath = path.toLowerCase()
	const name = lowerPath.split('/').pop() ?? lowerPath
	const lowerMime = mime?.toLowerCase() ?? ''

	return (
		name === 'openapi.json' ||
		name === 'openapi.yaml' ||
		name === 'openapi.yml' ||
		name === 'swagger.json' ||
		name === 'swagger.yaml' ||
		name === 'swagger.yml' ||
		name.endsWith('.openapi') ||
		name.endsWith('.openapi.json') ||
		name.endsWith('.openapi.yaml') ||
		name.endsWith('.openapi.yml') ||
		lowerMime.includes('openapi') ||
		lowerMime.includes('swagger')
	)
}

const CODE_EXTENSIONS = new Set([
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'css',
	'scss',
	'less',
	'html',
	'htm',
	'xml',
	'sh',
	'bash',
	'zsh',
	'py',
	'rb',
	'go',
	'rs',
	'java',
	'c',
	'cpp',
	'h',
	'sql',
	'graphql',
	'toml',
	'ini',
	'env',
	'dockerfile',
	'makefile',
])

const REGISTRY: ViewerRegistration[] = [
	// Markdown — highest priority document format
	{
		test: (path, mime) => ['md', 'markdown'].includes(ext(path)) || hasMime(mime, 'text/markdown'),
		type: 'markdown',
		label: 'Markdown',
		priority: 60,
	},
	// OpenAPI — before generic JSON/YAML structured data
	{
		test: isOpenApi,
		type: 'openapi',
		label: 'OpenAPI',
		priority: 55,
	},
	// Image formats
	{
		test: (path, mime) =>
			['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'].includes(ext(path)) ||
			hasMime(mime, 'image/'),
		type: 'image',
		label: 'Image',
		priority: 40,
	},
	// PDF
	{
		test: (path, mime) => ext(path) === 'pdf' || hasMime(mime, 'application/pdf'),
		type: 'pdf',
		label: 'PDF',
		priority: 40,
	},
	// DOCX
	{
		test: (path, mime) =>
			ext(path) === 'docx' ||
			mime?.toLowerCase() ===
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		type: 'docx',
		label: 'DOCX',
		priority: 40,
	},
	// Video formats
	{
		test: (path, mime) =>
			['mp4', 'mov', 'webm', 'm4v', 'ogg'].includes(ext(path)) || hasMime(mime, 'video/'),
		type: 'video',
		label: 'Video',
		priority: 40,
	},
	// Structured data: JSON, YAML, CSV, XLSX
	{
		test: (path, mime) => {
			const e = ext(path)
			if (['json', 'yaml', 'yml', 'csv'].includes(e)) return true
			if (e === 'xlsx') return true
			if (hasMime(mime, 'application/json')) return true
			if (hasMime(mime, 'text/csv')) return true
			if (hasMime(mime, 'application/vnd.openxmlformats')) return true
			return false
		},
		type: 'structured',
		label: 'Structured',
		priority: 35,
	},
	// Code resources — project inspection only unless explicitly stored as Knowledge
	{
		test: (path) => CODE_EXTENSIONS.has(ext(path)),
		type: 'code',
		label: 'Code',
		priority: 20,
	},
	// Plain text — catch-all fallback
	{
		test: () => true,
		type: 'plain',
		label: 'Plain text',
		priority: 0,
	},
]

// Pre-sort descending by priority — stable since we never mutate after module load
const SORTED = [...REGISTRY].sort((a, b) => b.priority - a.priority)

/**
 * Resolve the best viewer for a given resource path and optional MIME type.
 * Always returns a registration (falls back to 'plain').
 */
export function resolveViewer(path: string, mime?: string): ViewerRegistration {
	for (const reg of SORTED) {
		if (reg.test(path, mime)) return reg
	}
	// SORTED always ends with the plain catch-all, so this is unreachable.
	return SORTED[SORTED.length - 1]
}
