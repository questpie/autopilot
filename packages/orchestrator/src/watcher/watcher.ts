import { join, relative, sep } from 'node:path'
import { type FSWatcher, watch } from 'chokidar'
import { logger } from '../logger'

/**
 * Discriminated union of filesystem events the watcher can emit.
 *
 * Only config/content files that are human-edited YAML or knowledge files.
 * Tasks, messages, and pins are DB-only — no YAML watching needed.
 */
export type WatchEvent =
	| { type: 'config_changed'; file: string; path: string }
	| { type: 'dashboard_changed'; file: string; path: string }
	| { type: 'knowledge_changed'; file: string; path: string }
	| { type: 'artifact_changed'; artifactId: string; path: string }

/** Configuration for the filesystem {@link Watcher}. */
export interface WatcherOptions {
	companyRoot: string
	onEvent: (event: WatchEvent) => Promise<void>
	debounceMs?: number
}

/**
 * Map a changed file path to a typed {@link WatchEvent}.
 *
 * Returns `null` when the path does not match any known pattern.
 */
export function parseWatchEvent(companyRoot: string, filePath: string): WatchEvent | null {
	const rel = relative(companyRoot, filePath).split(sep).join('/')

	// dashboard/ changes (layout, widgets — not pins which are DB-only)
	const dashboardMatch = rel.match(/^dashboard\/(.+)$/)
	if (dashboardMatch?.[1]) {
		const dashFile = dashboardMatch[1]
		if (!dashFile.startsWith('pins/') && dashFile !== 'groups.yaml') {
			return { type: 'dashboard_changed', file: dashFile, path: filePath }
		}
	}

	// knowledge/{path} — any file change triggers reindex
	const knowledgeMatch = rel.match(/^knowledge\/(.+)$/)
	if (knowledgeMatch?.[1]) {
		return { type: 'knowledge_changed', file: knowledgeMatch[1], path: filePath }
	}

	// artifacts/{name}/.artifact.yaml — artifact registration
	const artifactMatch = rel.match(/^artifacts\/([^/]+)\/.artifact\.yaml$/)
	if (artifactMatch?.[1]) {
		return { type: 'artifact_changed', artifactId: artifactMatch[1], path: filePath }
	}

	// team/roles/*.md — role prompt files
	const roleMatch = rel.match(/^team\/roles\/(.+\.md)$/)
	if (roleMatch?.[1]) {
		return { type: 'config_changed', file: `roles/${roleMatch[1]}`, path: filePath }
	}

	// team/**/*.yaml|yml (e.g. agents/dev.yaml, workflows/deploy.yml, roles.yaml)
	const teamMatch = rel.match(/^team\/(.+\.ya?ml)$/)
	if (teamMatch?.[1]) {
		return { type: 'config_changed', file: teamMatch[1], path: filePath }
	}

	// company.yaml
	if (rel === 'company.yaml') {
		return { type: 'config_changed', file: 'company.yaml', path: filePath }
	}

	return null
}

/**
 * Watches company directories for file changes using chokidar.
 *
 * Debounces rapid writes (default 500ms) and emits typed events via
 * the `onEvent` callback.
 */
export class Watcher {
	private watcher: FSWatcher | null = null
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

	constructor(private options: WatcherOptions) {}

	/** Start watching config, dashboard, knowledge, team, and artifacts. */
	async start(): Promise<void> {
		const root = this.options.companyRoot
		const debounceMs = this.options.debounceMs ?? 500

		const watchPaths = [
			join(root, 'dashboard'),
			join(root, 'team'),
			join(root, 'knowledge'),
			join(root, 'artifacts'),
			join(root, 'company.yaml'),
		]

		this.watcher = watch(watchPaths, {
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 200 },
		})

		const handleFile = (filePath: string) => {
			const rel = relative(root, filePath).split(sep).join('/')
			const isYamlFile = filePath.endsWith('.yaml') || filePath.endsWith('.yml')
			const isDashboardFile =
				rel.startsWith('dashboard/') &&
				!rel.startsWith('dashboard/pins/') &&
				rel !== 'dashboard/groups.yaml'
			const isRoleFile = rel.startsWith('team/roles/') && filePath.endsWith('.md')
			const isKnowledgeFile = rel.startsWith('knowledge/')
			const isArtifactConfig = rel.match(/^artifacts\/[^/]+\/.artifact\.yaml$/)
			const isCompanyYaml = rel === 'company.yaml'
			if (
				!isYamlFile &&
				!isDashboardFile &&
				!isRoleFile &&
				!isKnowledgeFile &&
				!isArtifactConfig &&
				!isCompanyYaml
			)
				return

			const existing = this.debounceTimers.get(filePath)
			if (existing) clearTimeout(existing)

			this.debounceTimers.set(
				filePath,
				setTimeout(async () => {
					this.debounceTimers.delete(filePath)
					const event = parseWatchEvent(root, filePath)
					if (event) {
						try {
							await this.options.onEvent(event)
						} catch (err) {
							logger.error('watcher', 'error handling event', {
								error: err instanceof Error ? err.message : String(err),
							})
						}
					}
				}, debounceMs),
			)
		}

		this.watcher.on('add', handleFile)
		this.watcher.on('change', handleFile)
		this.watcher.on('unlink', handleFile)
	}

	/** Stop the watcher and clear any pending debounce timers. */
	async stop(): Promise<void> {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer)
		}
		this.debounceTimers.clear()

		if (this.watcher) {
			await this.watcher.close()
			this.watcher = null
		}
	}
}
