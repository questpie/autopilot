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
	ENVIRONMENTS_DIR: '.autopilot/environments',
	PROVIDERS_DIR: '.autopilot/providers',
	HANDLERS_DIR: '.autopilot/handlers',
	SKILLS_DIR: '.autopilot/skills',
	CONTEXT_DIR: '.autopilot/context',

	// Runtime state (not under .autopilot/)
	DATA_DIR: '.data',
	WORKTREES_DIR: '.worktrees',
} as const
