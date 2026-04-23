import type { ProjectService } from '../services/projects'
import type { ConfigService } from './config-service'
import type { ScopeChain } from './scope-resolver'
import {
	loadAgentsFromRoot,
	loadCapabilityProfilesFromRoot,
	loadContextFromRoot,
	loadEnvironmentsFromRoot,
	loadProvidersFromRoot,
	loadScriptsFromRoot,
	loadSkillsFromRoot,
	loadWorkflowsFromRoot,
} from './scope-resolver'

export async function importAuthoredConfigFromScopes(
	configService: ConfigService,
	projectService: ProjectService,
	chain: ScopeChain,
): Promise<{ projectId: string | null }> {
	if (chain.company) {
		await configService.set('company', 'company', chain.company)
	}

	if (chain.companyRoot) {
		await importRootConfig(configService, chain.companyRoot, null)
	}

	let projectId: string | null = null
	if (chain.project && chain.projectRoot && chain.projectRoot !== chain.companyRoot) {
		const project = await projectService.register({
			name: chain.project.name,
			path: chain.projectRoot,
		})
		projectId = project.id
		await configService.set('project', projectId, chain.project)
		await importRootConfig(configService, chain.projectRoot, projectId)
	}

	return { projectId }
}

async function importRootConfig(
	configService: ConfigService,
	root: string,
	projectId: string | null,
): Promise<void> {
	const [agents, workflows, environments, providers, capabilities, skills, context, scripts] =
		await Promise.all([
			loadAgentsFromRoot(root),
			loadWorkflowsFromRoot(root),
			loadEnvironmentsFromRoot(root),
			loadProvidersFromRoot(root),
			loadCapabilityProfilesFromRoot(root),
			loadSkillsFromRoot(root),
			loadContextFromRoot(root),
			loadScriptsFromRoot(root),
		])

	for (const agent of agents) await configService.set('agents', agent.id, agent, projectId)
	for (const workflow of workflows)
		await configService.set('workflows', workflow.id, workflow, projectId)
	for (const environment of environments)
		await configService.set('environments', environment.id, environment, projectId)
	for (const provider of providers)
		await configService.set('providers', provider.id, provider, projectId)
	for (const capability of capabilities)
		await configService.set('capabilities', capability.id, capability, projectId)
	for (const [skillId, skill] of skills)
		await configService.set('skills', skillId, skill, projectId)
	for (const [contextId, content] of context)
		await configService.set('context', contextId, content, projectId)
	for (const script of scripts) await configService.set('scripts', script.id, script, projectId)
}
