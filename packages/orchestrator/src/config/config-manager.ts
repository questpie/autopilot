/**
 * ConfigManager — owns the live authored config with safe hot reload.
 *
 * Properties:
 * - holds the current validated AuthoredConfig
 * - reload() reads from disk, validates, swaps atomically on success
 * - on failure: keeps old config, logs error, tracks last error
 * - file watcher with debounce for .autopilot/ changes
 */
import { existsSync, watch as fsWatch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { AuthoredConfig } from '../services/workflow-engine'
import { discoverScopes, resolveConfig, type ScopeChain } from './scope-resolver'

export interface ConfigManagerOptions {
	/** Company root directory for scope discovery. */
	companyRoot: string
	/** Initial scope chain (avoids re-discovery on first load). */
	initialChain?: ScopeChain
	/** Debounce window for file watcher in ms. Default: 500. */
	debounceMs?: number
	/** Callback invoked after a successful reload with the new config. */
	onReload?: (config: AuthoredConfig) => void
}

export interface ReloadResult {
	ok: boolean
	error?: string
}

export class ConfigManager {
	private config: AuthoredConfig
	private readonly companyRoot: string
	private readonly debounceMs: number
	private readonly onReload?: (config: AuthoredConfig) => void

	private watchers: FSWatcher[] = []
	private reloadTimer: ReturnType<typeof setTimeout> | null = null

	/** ISO timestamp of last successful reload (null = initial load only). */
	lastReloadAt: string | null = null
	/** Last reload error message, cleared on success. */
	lastError: string | null = null
	/** Total number of successful reloads since start. */
	reloadCount = 0

	constructor(initialConfig: AuthoredConfig, options: ConfigManagerOptions) {
		this.config = initialConfig
		this.companyRoot = options.companyRoot
		this.debounceMs = options.debounceMs ?? 500
		this.onReload = options.onReload
	}

	/** Get the current validated authored config. */
	get(): AuthoredConfig {
		return this.config
	}

	/**
	 * Reload config from disk.
	 *
	 * 1. Re-discover scopes
	 * 2. Resolve and validate config
	 * 3. On success: atomically swap all fields on the existing object, invoke onReload
	 * 4. On failure: keep old config, record error
	 */
	async reload(): Promise<ReloadResult> {
		try {
			const newChain = await discoverScopes(this.companyRoot)
			const newResolved = await resolveConfig(newChain)

			// Build the new config snapshot for validation
			const newConfig: AuthoredConfig = {
				company: newResolved.company,
				agents: newResolved.agents,
				workflows: newResolved.workflows,
				environments: newResolved.environments,
				providers: newResolved.providers,
				capabilityProfiles: newResolved.capabilityProfiles,
				skills: newResolved.skills,
				context: newResolved.context,
				scripts: newResolved.scripts,
				defaults: newResolved.defaults,
				queues: newResolved.company.queues ?? {},
			}

			// Atomic swap — single-threaded JS means these synchronous assignments
			// cannot be observed in a half-applied state by any request handler.
			this.config.company = newConfig.company
			this.config.agents = newConfig.agents
			this.config.workflows = newConfig.workflows
			this.config.environments = newConfig.environments
			this.config.providers = newConfig.providers
			this.config.capabilityProfiles = newConfig.capabilityProfiles
			this.config.skills = newConfig.skills
			this.config.context = newConfig.context
			this.config.scripts = newConfig.scripts
			this.config.defaults = newConfig.defaults
			this.config.queues = newConfig.queues

			this.lastReloadAt = new Date().toISOString()
			this.lastError = null
			this.reloadCount++

			console.log(
				`[config] reloaded (${newConfig.agents.size} agents, ${newConfig.workflows.size} workflows, ${newConfig.environments.size} environments, ${newConfig.providers.size} providers, ${newConfig.skills.size} skills, ${newConfig.scripts.size} scripts)`,
			)

			this.onReload?.(this.config)

			return { ok: true }
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			this.lastError = message
			console.error(`[config] reload failed (keeping previous config): ${message}`)
			return { ok: false, error: message }
		}
	}

	/** Start watching .autopilot/ directories for changes. */
	startWatching(chain: ScopeChain): void {
		this.watchDir(chain.companyRoot!)
		if (chain.projectRoot && chain.projectRoot !== chain.companyRoot) {
			this.watchDir(chain.projectRoot)
		}
	}

	/** Stop all watchers and pending timers. */
	stop(): void {
		if (this.reloadTimer) {
			clearTimeout(this.reloadTimer)
			this.reloadTimer = null
		}
		for (const w of this.watchers) w.close()
		this.watchers = []
	}

	/** Status snapshot for health/status endpoints. */
	status(): { lastReloadAt: string | null; lastError: string | null; reloadCount: number } {
		return {
			lastReloadAt: this.lastReloadAt,
			lastError: this.lastError,
			reloadCount: this.reloadCount,
		}
	}

	// ── Private ───────────────────────────────────────────────────────────

	private scheduleReload(): void {
		if (this.reloadTimer) clearTimeout(this.reloadTimer)
		this.reloadTimer = setTimeout(() => {
			this.reloadTimer = null
			void this.reload()
		}, this.debounceMs)
	}

	private watchDir(dir: string): void {
		const autopilotDir = join(dir, '.autopilot')
		if (!existsSync(autopilotDir)) return
		try {
			const watcher = fsWatch(autopilotDir, { recursive: true }, (_event, filename) => {
				if (filename && (filename.endsWith('.yaml') || filename.endsWith('.yml') || filename.endsWith('.md'))) {
					this.scheduleReload()
				}
			})
			this.watchers.push(watcher)
		} catch (err) {
			console.warn('[config] could not watch', autopilotDir, ':', err instanceof Error ? err.message : String(err))
		}
	}
}
