import { z } from 'zod'
import type { StorageBackend } from '../fs/storage'
import type { EventBus } from '../events/event-bus'
import type { AIProvider } from '../ai/provider'
import { createTaskTool } from './tools/task'
import { createMessageTool } from './tools/message'
import { createPinTool } from './tools/pin'
import { createSearchTool } from './tools/search'
import { createHttpTool } from './tools/http'
import { createSearchWebTool } from './tools/search-web'

// ─── Tool definition types ─────────────────────────────────────────────────

/** A single tool that an agent can invoke during a session. */
export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
	name: string
	description: string
	schema: T
	execute: (args: z.output<T>, context: ToolContext) => Promise<ToolResult>
}

/** Contextual data passed to every tool execution. */
export interface ToolContext {
	companyRoot: string
	agentId: string
	storage: StorageBackend
	eventBus: EventBus
}

/** Structured result returned to the LLM after a tool call. */
export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>
	isError?: boolean
}

// ─── Autopilot tool options ────────────────────────────────────────────────

export interface AutopilotToolOptions {
	/** If set and non-empty, only requests to these hostnames are allowed. */
	httpAllowlist?: string[]
}

// ─── Autopilot tool definitions ────────────────────────────────────────────

/**
 * Build the full set of autopilot tools available to agents.
 *
 * Includes: `task`, `message`, `pin`, `search_index`, `fetch`, `web_search`.
 */
export function createAutopilotTools(companyRoot: string, storage: StorageBackend, aiProvider: AIProvider, options?: AutopilotToolOptions): ToolDefinition[] {
	// biome-ignore lint: generic variance is intentional
	const tools: Array<ToolDefinition<any>> = [
		createTaskTool(storage),
		createMessageTool(storage, companyRoot),
		createPinTool(companyRoot),
		createSearchTool(companyRoot),
		createHttpTool(companyRoot, options),
		createSearchWebTool(aiProvider),
	]

	return tools
}

/** Find a tool by name and execute it */
export async function executeTool(
	tools: ToolDefinition[],
	toolName: string,
	args: unknown,
	context: ToolContext,
): Promise<ToolResult> {
	const tool = tools.find((t) => t.name === toolName)
	if (!tool) {
		return {
			content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
			isError: true,
		}
	}

	try {
		const parsed = tool.schema.parse(args)
		return await tool.execute(parsed, context)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return {
			content: [{ type: 'text', text: `Tool error (${toolName}): ${msg}` }],
			isError: true,
		}
	}
}
