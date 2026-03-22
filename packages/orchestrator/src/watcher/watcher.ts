import { watch, type FSWatcher } from 'chokidar'
import { join, relative, sep } from 'node:path'

export type WatchEvent =
	| { type: 'task_changed'; taskId: string; path: string }
	| { type: 'message_received'; channel: string; path: string }
	| { type: 'pin_changed'; pinId: string; path: string }
	| { type: 'config_changed'; file: string; path: string }

export interface WatcherOptions {
	companyRoot: string
	onEvent: (event: WatchEvent) => Promise<void>
	debounceMs?: number
}

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

	// team/*.yaml
	const teamMatch = rel.match(/^team\/(.+\.yaml)$/)
	if (teamMatch?.[1]) {
		return { type: 'config_changed', file: teamMatch[1], path: filePath }
	}

	return null
}

export class Watcher {
	private watcher: FSWatcher | null = null
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

	constructor(private options: WatcherOptions) {}

	async start(): Promise<void> {
		const root = this.options.companyRoot
		const debounceMs = this.options.debounceMs ?? 500

		const watchPaths = [
			join(root, 'tasks'),
			join(root, 'comms'),
			join(root, 'dashboard', 'pins'),
			join(root, 'team'),
		]

		this.watcher = watch(watchPaths, {
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 200 },
		})

		const handleFile = (filePath: string) => {
			if (!filePath.endsWith('.yaml')) return

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
							console.error('[watcher] error handling event:', err)
						}
					}
				}, debounceMs),
			)
		}

		this.watcher.on('add', handleFile)
		this.watcher.on('change', handleFile)
	}

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
