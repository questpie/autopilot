/**
 * Canonical filesystem paths for all autopilot configuration and data.
 * All paths are relative to a scope root (company or project).
 */
export const PATHS = {
	// Scope markers
	AUTOPILOT_DIR: '.autopilot',
	COMPANY_CONFIG: '.autopilot/company.yaml',
	PROJECT_CONFIG: '.autopilot/project.yaml',

	// Authored config (under .autopilot/)
	AGENTS_DIR: '.autopilot/agents',
	WORKFLOWS_DIR: '.autopilot/workflows',
	TYPES_DIR: '.autopilot/types',
	ENVIRONMENTS_DIR: '.autopilot/environments',
	PROVIDERS_DIR: '.autopilot/providers',
	HANDLERS_DIR: '.autopilot/handlers',
	CAPABILITIES_DIR: '.autopilot/capabilities',
	SKILLS_DIR: '.autopilot/skills',
	CONTEXT_DIR: '.autopilot/context',
	SCRIPTS_DIR: '.autopilot/scripts',

	// Pack distribution
	REGISTRIES_CONFIG: '.autopilot/registries.yaml',
	PACKS_LOCKFILE: '.autopilot/packs.lock.yaml',

	// Global user config (under ~/.config/autopilot/)
	GLOBAL_CONFIG_DIR: '.config/autopilot',
	GLOBAL_REGISTRIES_CONFIG: '.config/autopilot/registries.yaml',

	// Runtime state (not under .autopilot/)
	DATA_DIR: '.data',
	WORKTREES_DIR: '.worktrees',
	PACK_CACHE_DIR: '.data/pack-cache',
} as const
