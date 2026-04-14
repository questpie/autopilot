import { minimatch } from 'minimatch'
import type { TypeRegistry } from './type-registry'

export type ResolverInput = {
  path: string
  is_dir: boolean
  frontmatter: Record<string, unknown> | null
}

export type ResolverResult = {
  type: string | null
  source:
    | 'frontmatter'
    | 'compound_ext'
    | 'glob'
    | 'parent_directive'
    | 'plain_ext'
    | 'implicit'
    | 'fallback'
    | 'unknown'
}

export const BUILTIN_EXTENSION_MAP: Record<string, string> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.pdf': 'pdf',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.db': 'sqlite-database',
  '.sqlite': 'sqlite-database',
  '.csv': 'csv',
  '.txt': 'text',
}

export function resolveType(input: ResolverInput, registry: TypeRegistry): ResolverResult {
  return input.is_dir
    ? resolveFolderType(input, registry)
    : resolveFileType(input, registry)
}

function resolveFileType(input: ResolverInput, registry: TypeRegistry): ResolverResult {
  // 1. Explicit frontmatter type
  if (input.frontmatter?.type && typeof input.frontmatter.type === 'string') {
    if (registry.has(input.frontmatter.type)) {
      return { type: input.frontmatter.type, source: 'frontmatter' }
    }
  }

  // 2. Compound extension (*.invoice.yaml → invoice)
  const compound = parseCompoundExt(input.path)
  if (compound && registry.has(compound)) {
    return { type: compound, source: 'compound_ext' }
  }

  // 3. Glob match against registered types
  for (const type of registry.allWithGlobs()) {
    if (type.match.glob && minimatch(input.path, type.match.glob)) {
      if (type.match.is_dir !== true) {
        return { type: type.id, source: 'glob' }
      }
    }
  }

  // 4. Plain extension fallback
  const ext = parsePlainExt(input.path)
  const builtinId = ext ? BUILTIN_EXTENSION_MAP[ext] : undefined
  if (builtinId && registry.has(builtinId)) {
    return { type: builtinId, source: 'plain_ext' }
  }

  // 5. Unknown
  return { type: null, source: 'unknown' }
}

function resolveFolderType(input: ResolverInput, registry: TypeRegistry): ResolverResult {
  // 1. .folder.yaml manifest type
  if (input.frontmatter?.type && typeof input.frontmatter.type === 'string') {
    if (registry.has(input.frontmatter.type)) {
      return { type: input.frontmatter.type, source: 'frontmatter' }
    }
  }

  // 2. Parent directive
  const parentType = registry.getParentChildrenType(input.path)
  if (parentType && registry.has(parentType)) {
    return { type: parentType, source: 'parent_directive' }
  }

  // 3. Glob match (dir only)
  for (const type of registry.allWithGlobs()) {
    if (type.match.glob && type.match.is_dir === true && minimatch(input.path + '/', type.match.glob)) {
      return { type: type.id, source: 'glob' }
    }
  }

  // 4. Unknown
  return { type: null, source: 'unknown' }
}

/** Extract compound extension: "invoices/FA-001.invoice.yaml" → "invoice" */
export function parseCompoundExt(path: string): string | null {
  const filename = path.split('/').pop() ?? ''
  const parts = filename.split('.')
  if (parts.length >= 3) {
    return parts[parts.length - 2] ?? null
  }
  return null
}

/** Extract plain extension: "README.md" → ".md" */
export function parsePlainExt(path: string): string | null {
  const filename = path.split('/').pop() ?? ''
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot) : null
}
