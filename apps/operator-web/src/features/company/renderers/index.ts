import { rendererRegistry, registerFallback } from '@/lib/renderer-registry'
import { GenericFallbackRenderer } from './generic-fallback'
import { GenericFolderRenderer } from './generic-folder-renderer'
import { GenericDetailCardRenderer } from './generic-detail-card'
import { GenericTableRenderer } from './generic-table-renderer'
import { MarkdownRenderer } from './markdown-renderer'
import { YamlFormRenderer } from './yaml-form-renderer'

// Register the catch-all fallback via the dedicated mechanism
registerFallback(GenericFallbackRenderer)

// Generic fallbacks — lowest priority, is_dir scoped
rendererRegistry.register({
  id: 'generic-folder',
  component: GenericFolderRenderer,
  match: { is_dir: true, fallback: true },
  priority: 0,
})
rendererRegistry.register({
  id: 'generic-file',
  component: GenericFallbackRenderer,
  match: { is_dir: false, fallback: true },
  priority: 0,
})

// Built-in file-type renderers — mid priority
rendererRegistry.register({
  id: 'markdown',
  component: MarkdownRenderer,
  match: { type: 'markdown' },
  priority: 10,
})
rendererRegistry.register({
  id: 'yaml-form',
  component: YamlFormRenderer,
  match: { type: 'yaml' },
  priority: 10,
})

// Generic config-driven renderers — matched explicitly by type string when needed
// Register them at mid-low priority with type keys set at call-site.
// The strings 'detail-card' and 'table' are synthetic type values that a
// TypeDefinition with renderer.generic.kind can be mapped to by consuming code.
rendererRegistry.register({
  id: 'generic-detail-card',
  component: GenericDetailCardRenderer,
  match: { type: 'detail-card' },
  priority: 5,
})
rendererRegistry.register({
  id: 'generic-table',
  component: GenericTableRenderer,
  match: { type: 'table', is_dir: true },
  priority: 5,
})

export { rendererRegistry }
