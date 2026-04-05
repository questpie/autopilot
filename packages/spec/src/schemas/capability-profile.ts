import { z } from 'zod'

/**
 * A capability profile declares which runtime capabilities should be active
 * for a given step or agent run — skills, MCP servers, context, prompts.
 *
 * Profiles are authored under `.autopilot/capabilities/*.yaml` and referenced
 * by ID from agents and workflow steps.
 *
 * The profile is runtime-neutral authored intent. The worker translates it
 * into concrete runtime setup (e.g. Claude Code --allowedTools, MCP config subset).
 */
export const CapabilityProfileSchema = z.object({
	/** Unique profile identifier (e.g. "code-review", "ops-telegram"). */
	id: z.string().min(1),
	/** Human-readable description. */
	description: z.string().default(''),
	/** Repo-native skill identifiers to activate (names from .autopilot/skills/). */
	skills: z.array(z.string()).default([]),
	/** MCP server identifiers to include in the runtime MCP config. */
	mcp_servers: z.array(z.string()).default([]),
	/** Context file identifiers to include (names from .autopilot/context/). */
	context: z.array(z.string()).default([]),
	/** Additional prompt fragments injected into the run instructions. */
	prompts: z.array(z.string()).default([]),
})

/**
 * Resolved capability set — the merged result of all active profiles for a run.
 * This is what the orchestrator sends to the worker in the claim payload.
 * The worker translates this into runtime-specific configuration.
 */
export const ResolvedCapabilitiesSchema = z.object({
	/** Active skill identifiers (deduplicated). */
	skills: z.array(z.string()).default([]),
	/** Active MCP server identifiers (deduplicated). */
	mcp_servers: z.array(z.string()).default([]),
	/** Active context file identifiers (deduplicated). */
	context: z.array(z.string()).default([]),
	/** Prompt fragments to inject (in order). */
	prompts: z.array(z.string()).default([]),
})
