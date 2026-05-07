/**
 * ConfigManager owns the live DB-backed authored config snapshot.
 *
 * `.autopilot/` bundles may seed/import config, but live reload reads from the
 * config registry only. There is no filesystem watcher or filesystem fallback.
 */
import type { AuthoredConfig } from '../services/workflow-engine'
import type { ConfigService } from './config-service'

export interface ConfigManagerOptions {
	/** DB-backed config service used for all live reloads. */
	configService: Pick<ConfigService, 'loadAuthoredConfig'>
	/** Active project scope for this server instance. */
	projectId?: string | null
	/** Callback invoked after a successful reload with the new config. May be async. */
	onReload?: (config: AuthoredConfig) => void | Promise<void>
}

export interface ReloadResult {
	ok: boolean
	error?: string
}

export class ConfigManager {
	private config: AuthoredConfig
	private readonly configService: Pick<ConfigService, 'loadAuthoredConfig'>
	private readonly projectId: string | null
	private readonly onReload?: (config: AuthoredConfig) => void | Promise<void>

	/** ISO timestamp of last successful reload (null = initial load only). */
	lastReloadAt: string | null = null
	/** Last reload error message, cleared on success. */
	lastError: string | null = null
	/** Total number of successful reloads since start. */
	reloadCount = 0

	constructor(initialConfig: AuthoredConfig, options: ConfigManagerOptions) {
		this.config = initialConfig
		this.configService = options.configService
		this.projectId = options.projectId ?? null
		this.onReload = options.onReload
	}

	/** Get the current validated authored config object. */
	get(): AuthoredConfig {
		return this.config
	}

	/**
	 * Reload config from the DB config registry.
	 *
	 * On success, fields are swapped on the existing object so request handlers
	 * holding the old reference see the new config. On failure, the old config is
	 * preserved and the error is recorded.
	 */
	async reload(): Promise<ReloadResult> {
		try {
			const newConfig = await this.configService.loadAuthoredConfig(this.projectId)

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

			await this.onReload?.(this.config)

			return { ok: true }
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			this.lastError = message
			console.error(`[config] reload failed (keeping previous config): ${message}`)
			return { ok: false, error: message }
		}
	}

	/** No-op kept for shutdown symmetry. */
	stop(): void {}

	/** Status snapshot for health/status endpoints. */
	status(): { lastReloadAt: string | null; lastError: string | null; reloadCount: number } {
		return {
			lastReloadAt: this.lastReloadAt,
			lastError: this.lastError,
			reloadCount: this.reloadCount,
		}
	}
}
