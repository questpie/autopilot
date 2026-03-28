import { watch, type FSWatcher } from 'chokidar'
import { join, relative, sep } from 'node:path'
import { logger } from '../logger'

/** Discriminated union of filesystem events the watcher can emit. */
export type WatchEvent =
	| { type: 'task_changed'; taskId: string; path: string }
	| { type: 'message_received'; channel: string; path: string }
	| { type: 'pin_changed'; pinId: string; path: string }
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

	// tasks/{status}/{id}.yaml
	const taskMatch = rel.match(/^tasks\/[^/]+\/([^/]+)\.yaml$/)
	if (taskMatch?.[1]) {
		return { type: 'task_changed', taskId: taskMatch[1], path: filePath }
	}

	// comms/channels/{channel}/{id}.yaml
	const commsMatch = rel.match(/^comms\/channels\/([^/]+)\/[^/]+\.yaml$/)
	if (commsMatch?.[1]) {
		return { type: 'message_received', channel: commsMatch[1], path: filePath }
	}

	// dashboard/pins/{id}.yaml
	const pinMatch = rel.match(/^dashboard\/pins\/([^/]+)\.yaml$/)
	if (pinMatch?.[1]) {
		return { type: 'pin_changed', pinId: pinMatch[1], path: filePath }
	}

	// dashboard/ changes (excluding pins/ and groups.yaml)
	const dashboardMatch = rel.match(/^dashboard\/(.+)$/)
	if (dashboardMatch?.[1]) {
		const dashFile = dashboardMatch[1]
		// Skip pins/ and groups.yaml — those are data, not dashboard customization
		if (!dashFile.startsWith('pins/') && dashFile !== 'groups.yaml') {
			return { type: 'dashboard_changed', file: dashFile, path: filePath }
		}
	}

	// TM-005: knowledge/{path} — any file change triggers reindex
	const knowledgeMatch = rel.match(/^knowledge\/(.+)$/)
	if (knowledgeMatch?.[1]) {
		return { type: 'knowledge_changed', file: knowledgeMatch[1], path: filePath }
	}

	// TM-006: artifacts/{name}/.artifact.yaml — artifact registration
	const artifactMatch = rel.match(/^artifacts\/([^/]+)\/.artifact\.yaml$/)
	if (artifactMatch?.[1]) {
		return { type: 'artifact_changed', artifactId: artifactMatch[1], path: filePath }
	}

	// team/roles/*.md — role prompt files
	const roleMatch = rel.match(/^team\/roles\/(.+\.md)$/)
	if (roleMatch?.[1]) {
		return { type: 'config_changed', file: `roles/${roleMatch[1]}`, path: filePath }
	}

	// team/*.yaml
	const teamMatch = rel.match(/^team\/(.+\.yaml)$/)
	if (teamMatch?.[1]) {
		return { type: 'config_changed', file: teamMatch[1], path: filePath }
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

	/** Start watching `tasks/`, `comms/`, `dashboard/`, `team/`, `knowledge/`, and `artifacts/`. */
	async start(): Promise<void> {
		const root = this.options.companyRoot
		const debounceMs = this.options.debounceMs ?? 500

		const watchPaths = [
			join(root, 'tasks'),
			join(root, 'comms'),
			join(root, 'dashboard'),
			join(root, 'team'),
			join(root, 'knowledge'),
			join(root, 'artifacts'),
		]

		this.watcher = watch(watchPaths, {
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 200 },
		})

		const handleFile = (filePath: string) => {
			const rel = relative(root, filePath).split(sep).join('/')
			const isDashboardFile = rel.startsWith('dashboard/') && !rel.startsWith('dashboard/pins/') && rel !== 'dashboard/groups.yaml'
			const isRoleFile = rel.startsWith('team/roles/') && filePath.endsWith('.md')
			const isKnowledgeFile = rel.startsWith('knowledge/')
			const isArtifactConfig = rel.match(/^artifacts\/[^/]+\/.artifact\.yaml$/)
			if (!filePath.endsWith('.yaml') && !isDashboardFile && !isRoleFile && !isKnowledgeFile && !isArtifactConfig) return

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
							logger.error('watcher', 'error handling event', { error: err instanceof Error ? err.message : String(err) })
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
