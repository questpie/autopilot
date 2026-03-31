import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS, WorkflowSchema } from '@questpie/autopilot-spec'
import { parse as parseYaml } from 'yaml'
import { compileWorkflow } from './compiler'
import type { CompiledWorkflow } from './compiler'

/**
 * Loads and caches workflow definitions from the company filesystem.
 *
 * Workflows live at `<companyRoot>/company/team/workflows/<id>.yaml`.
 * The loader validates each file against the WorkflowSchema and caches
 * the parsed result in memory until explicitly invalidated.
 */
export class WorkflowLoader {
	private cache = new Map<string, CompiledWorkflow>()

	constructor(private companyRoot: string) {}

	/**
	 * Resolve the absolute path for a workflow file.
	 */
	private workflowDir(): string {
		return join(this.companyRoot, PATHS.WORKFLOWS_DIR)
	}

	private workflowFile(workflowId: string): string {
		return join(this.workflowDir(), `${workflowId}.yaml`)
	}

	/**
	 * Load a single workflow by id. Returns from cache if available.
	 */
	async load(workflowId: string): Promise<CompiledWorkflow> {
		const cached = this.cache.get(workflowId)
		if (cached) return cached

		const filePath = this.workflowFile(workflowId)
		const content = await readFile(filePath, 'utf-8')
		const raw = parseYaml(content)
		const workflow = compileWorkflow(WorkflowSchema.parse(raw))

		this.cache.set(workflowId, workflow)
		return workflow
	}

	/**
	 * Load all workflows from the workflows directory.
	 */
	async loadAll(): Promise<Map<string, CompiledWorkflow>> {
		const dir = this.workflowDir()
		let entries: string[]

		try {
			entries = await readdir(dir)
		} catch {
			return new Map()
		}

		const yamlFiles = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))

		for (const file of yamlFiles) {
			const id = file.replace(/\.ya?ml$/, '')
			if (!this.cache.has(id)) {
				try {
					await this.load(id)
				} catch {
					// Skip invalid workflow files
				}
			}
		}

		return new Map(this.cache)
	}

	/**
	 * Invalidate cached workflows. Pass a specific id to invalidate one,
	 * or call with no arguments to clear the entire cache.
	 */
	invalidate(workflowId?: string): void {
		if (workflowId) {
			this.cache.delete(workflowId)
		} else {
			this.cache.clear()
		}
	}
}
