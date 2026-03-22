import { join } from 'node:path'
import { AgentMemorySchema, agentMemoryPath } from '@questpie/autopilot-spec'
import type { AgentMemory } from '@questpie/autopilot-spec'
import { readYaml, fileExists } from '../fs/yaml'

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

/**
 * Load an agent's persistent memory from `memory.yaml`.
 *
 * Returns `null` if no memory file exists or if it fails validation.
 */
export async function loadAgentMemory(
	companyRoot: string,
	agentId: string,
): Promise<AgentMemory | null> {
	const memoryFile = resolvePath(companyRoot, `${agentMemoryPath(agentId)}/memory.yaml`)

	if (!(await fileExists(memoryFile))) {
		return null
	}

	try {
		return await readYaml(memoryFile, AgentMemorySchema)
	} catch {
		return null
	}
}
