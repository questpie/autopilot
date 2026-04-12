/**
 * ScriptService — resolves standalone scripts from authored config.
 * Phase 1: read-only (config-driven). Phase 3+: database-backed with execution history.
 */
import type { StandaloneScript } from '@questpie/autopilot-spec'
import type { AuthoredConfig } from './workflow-engine'

export class ScriptService {
	constructor(private config: AuthoredConfig) {}

	list(): StandaloneScript[] {
		return this.config.scripts ? [...this.config.scripts.values()] : []
	}

	get(id: string): StandaloneScript | undefined {
		return this.config.scripts?.get(id)
	}

	resolveRef(scriptId: string): StandaloneScript | undefined {
		return this.config.scripts?.get(scriptId)
	}
}
