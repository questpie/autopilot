import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, separator, error } from '../utils/format'
import { getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentDef = {
	id: string
	name: string
	role: string
	description?: string
	model?: string
	provider?: string
	variant?: string
	capability_profiles?: string[]
}

type WorkflowDef = {
	id: string
	name: string
	description?: string
	steps: Array<{
		id: string
		type: string
		agent_id?: string
		instructions?: string
	}>
}

type EnvironmentDef = {
	id: string
	name: string
	description?: string
	required_tags?: string[]
	secret_refs?: Array<{ key: string }>
}

type ProviderDef = {
	id: string
	name: string
	kind: string
	handler: string
	capabilities?: string[]
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

function configHeaders(): Record<string, string> {
	const headers: Record<string, string> = { ...getAuthHeaders() }
	if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'
	return headers
}

async function fetchConfig<T>(endpoint: string): Promise<T> {
	const res = await fetch(`${getBaseUrl()}/api/config/${endpoint}`, { headers: configHeaders() })
	if (!res.ok) throw new Error(`Failed to fetch config/${endpoint} (${res.status})`)
	return res.json()
}

// ─── Config command group ───────────────────────────────────────────────────

const configCmd = new Command('config')
	.description('Inspect loaded orchestrator configuration')

// ── config show ─────────────────────────────────────────────────────────────

configCmd.addCommand(
	new Command('show')
		.description('Overview of loaded configuration')
		.action(async () => {
			try {
				const [agents, workflows, environments, providers] = await Promise.all([
					fetchConfig<AgentDef[]>('agents'),
					fetchConfig<WorkflowDef[]>('workflows'),
					fetchConfig<EnvironmentDef[]>('environments'),
					fetchConfig<ProviderDef[]>('providers'),
				])

				console.log(section('Config Overview'))
				console.log('')
				console.log(`  ${dim('Agents:')}       ${agents.length}${agents.length > 0 ? `  ${dim(`(${agents.map((a) => a.id).join(', ')})`)}` : ''}`)
				console.log(`  ${dim('Workflows:')}    ${workflows.length}${workflows.length > 0 ? `  ${dim(`(${workflows.map((w) => w.id).join(', ')})`)}` : ''}`)
				console.log(`  ${dim('Environments:')} ${environments.length}${environments.length > 0 ? `  ${dim(`(${environments.map((e) => e.id).join(', ')})`)}` : ''}`)
				console.log(`  ${dim('Providers:')}    ${providers.length}${providers.length > 0 ? `  ${dim(`(${providers.map((p) => p.id).join(', ')})`)}` : ''}`)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── config agent [id] ───────────────────────────────────────────────────────

configCmd.addCommand(
	new Command('agent')
		.description('List agents or show one by ID')
		.argument('[id]', 'Agent ID (omit to list all)')
		.action(async (id?: string) => {
			try {
				const agents = await fetchConfig<AgentDef[]>('agents')

				if (id) {
					const agent = agents.find((a) => a.id === id)
					if (!agent) {
						console.error(error(`Agent not found: ${id}`))
						console.error(dim('Use "autopilot config agent" to list all agents.'))
						process.exit(1)
					}

					console.log(section(agent.name))
					console.log('')
					console.log(`  ${dim('ID:')}          ${agent.id}`)
					console.log(`  ${dim('Role:')}        ${agent.role}`)
					if (agent.description) console.log(`  ${dim('Description:')} ${agent.description}`)
					if (agent.model) console.log(`  ${dim('Model:')}       ${agent.model}`)
					if (agent.provider) console.log(`  ${dim('Provider:')}    ${agent.provider}`)
					if (agent.variant) console.log(`  ${dim('Variant:')}     ${agent.variant}`)
					if (agent.capability_profiles && agent.capability_profiles.length > 0) {
						console.log(`  ${dim('Capabilities:')} ${agent.capability_profiles.join(', ')}`)
					}
					return
				}

				console.log(section('Agents'))
				if (agents.length === 0) {
					console.log(dim('  No agents defined'))
					return
				}

				console.log(
					table(
						agents.map((a) => [
							a.id,
							a.name,
							dim(a.role),
							a.model ? dim(a.model) : '',
						]),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${agents.length} agent(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── config workflow [id] ────────────────────────────────────────────────────

configCmd.addCommand(
	new Command('workflow')
		.description('List workflows or show one by ID')
		.argument('[id]', 'Workflow ID (omit to list all)')
		.action(async (id?: string) => {
			try {
				const workflows = await fetchConfig<WorkflowDef[]>('workflows')

				if (id) {
					const wf = workflows.find((w) => w.id === id)
					if (!wf) {
						console.error(error(`Workflow not found: ${id}`))
						console.error(dim('Use "autopilot config workflow" to list all workflows.'))
						process.exit(1)
					}

					console.log(section(wf.name))
					console.log('')
					console.log(`  ${dim('ID:')}          ${wf.id}`)
					if (wf.description) console.log(`  ${dim('Description:')} ${wf.description}`)
					console.log(`  ${dim('Steps:')}       ${wf.steps.length}`)

					console.log('')
					for (let i = 0; i < wf.steps.length; i++) {
						const step = wf.steps[i]!
						const isLast = i === wf.steps.length - 1
						const prefix = isLast ? '\u2514\u2500' : '\u251C\u2500'
						const cont = isLast ? '  ' : '\u2502 '
						const typeColor = step.type === 'agent' ? 'cyan' : step.type === 'human_approval' ? 'yellow' : 'green'
						const agent = step.agent_id ? ` (${step.agent_id})` : ''

						console.log(`  ${prefix} ${badge(step.type, typeColor)} ${step.id}${agent}`)
						if (step.instructions) console.log(`  ${cont}  ${dim(step.instructions)}`)
					}
					return
				}

				console.log(section('Workflows'))
				if (workflows.length === 0) {
					console.log(dim('  No workflows defined'))
					return
				}

				console.log(
					table(
						workflows.map((wf) => [
							wf.id,
							wf.name,
							dim(`${wf.steps.length} steps`),
							dim(wf.steps.map((s) => s.id).join(' \u2192 ')),
						]),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${workflows.length} workflow(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── config provider [id] ────────────────────────────────────────────────────

configCmd.addCommand(
	new Command('provider')
		.description('List providers or show one by ID')
		.argument('[id]', 'Provider ID (omit to list all)')
		.action(async (id?: string) => {
			try {
				const providers = await fetchConfig<ProviderDef[]>('providers')

				if (id) {
					const prov = providers.find((p) => p.id === id)
					if (!prov) {
						console.error(error(`Provider not found: ${id}`))
						console.error(dim('Use "autopilot config provider" to list all providers.'))
						process.exit(1)
					}

					console.log(section(prov.name))
					console.log('')
					console.log(`  ${dim('ID:')}       ${prov.id}`)
					console.log(`  ${dim('Kind:')}     ${prov.kind}`)
					console.log(`  ${dim('Handler:')}  ${prov.handler}`)
					if (prov.capabilities && prov.capabilities.length > 0) {
						console.log(`  ${dim('Capabilities:')} ${prov.capabilities.join(', ')}`)
					}
					return
				}

				console.log(section('Providers'))
				if (providers.length === 0) {
					console.log(dim('  No providers defined'))
					return
				}

				console.log(
					table(
						providers.map((p) => [
							p.id,
							p.name,
							badge(p.kind, 'cyan'),
							dim(p.handler),
						]),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${providers.length} provider(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── config environment [id] ─────────────────────────────────────────────────

configCmd.addCommand(
	new Command('environment')
		.description('List environments or show one by ID')
		.argument('[id]', 'Environment ID (omit to list all)')
		.action(async (id?: string) => {
			try {
				const environments = await fetchConfig<EnvironmentDef[]>('environments')

				if (id) {
					const env = environments.find((e) => e.id === id)
					if (!env) {
						console.error(error(`Environment not found: ${id}`))
						console.error(dim('Use "autopilot config environment" to list all environments.'))
						process.exit(1)
					}

					console.log(section(env.name))
					console.log('')
					console.log(`  ${dim('ID:')}          ${env.id}`)
					if (env.description) console.log(`  ${dim('Description:')} ${env.description}`)
					if (env.required_tags && env.required_tags.length > 0) {
						console.log(`  ${dim('Tags:')}        ${env.required_tags.join(', ')}`)
					}
					if (env.secret_refs && env.secret_refs.length > 0) {
						console.log(`  ${dim('Secrets:')}     ${env.secret_refs.map((s) => s.key).join(', ')}`)
					}
					return
				}

				console.log(section('Environments'))
				if (environments.length === 0) {
					console.log(dim('  No environments defined'))
					return
				}

				console.log(
					table(
						environments.map((e) => [
							e.id,
							e.name,
							e.required_tags && e.required_tags.length > 0 ? dim(`tags: ${e.required_tags.join(', ')}`) : '',
						]),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${environments.length} environment(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(configCmd)
