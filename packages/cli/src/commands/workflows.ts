import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, separator, error } from '../utils/format'
import { getBaseUrl } from '../utils/client'
import { getAuthHeaders, loadCredentials } from './auth'

type WorkflowDef = {
	id: string
	name: string
	description?: string
	steps: Array<{
		id: string
		type: string
		agent_id?: string
		instructions?: string
		targeting?: Record<string, unknown>
		actions?: Array<{ kind: string; url_ref: string }>
	}>
}

// Raw fetch: /api/config/* routes are defined inline on the Hono app,
// not via .route(), so they are not part of the typed AppType chain.
async function fetchWorkflows(): Promise<WorkflowDef[]> {
	const headers: Record<string, string> = { ...getAuthHeaders() }
	if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'
	const res = await fetch(`${getBaseUrl()}/api/config/workflows`, { headers })
	if (!res.ok) throw new Error(`Failed to fetch workflows (${res.status})`)
	return res.json()
}

const workflowsCmd = new Command('workflow')
	.description('List and inspect authored workflows')
	.action(async () => {
		try {
			const workflows = await fetchWorkflows()

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
						dim(wf.steps.map((s) => s.id).join(' → ')),
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
	})

workflowsCmd.addCommand(
	new Command('show')
		.description('Show detailed workflow definition')
		.argument('<id>', 'Workflow ID')
		.action(async (id: string) => {
			try {
				const workflows = await fetchWorkflows()
				const wf = workflows.find((w) => w.id === id)
				if (!wf) {
					console.error(error(`Workflow not found: ${id}`))
					console.error(dim('Use "autopilot workflows" to list all workflows.'))
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
					const prefix = isLast ? '└─' : '├─'
					const cont = isLast ? '  ' : '│ '
					const typeColor = step.type === 'agent' ? 'cyan' : step.type === 'human_approval' ? 'yellow' : 'green'
					const agent = step.agent_id ? ` (${step.agent_id})` : ''

					console.log(`  ${prefix} ${badge(step.type, typeColor)} ${step.id}${agent}`)
					if (step.instructions) console.log(`  ${cont}  ${dim(step.instructions)}`)
					if (step.targeting) {
						const t = step.targeting
						if (t.required_runtime) console.log(`  ${cont}  ${dim(`runtime: ${t.required_runtime}`)}`)
						if (t.environment) console.log(`  ${cont}  ${dim(`env: ${t.environment}`)}`)
					}
					if (step.actions?.length) {
						console.log(`  ${cont}  ${dim(`${step.actions.length} post-action(s)`)}`)
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

workflowsCmd.addCommand(
	new Command('validate')
		.description('Validate authored workflow/agent/environment config references')
		.action(async () => {
			try {
				const orch = await import('@questpie/autopilot-orchestrator')

				const companyRoot = process.cwd()
				const company = await orch.loadCompany(companyRoot)
				const agentList = await orch.loadAgents(companyRoot)
				const workflowList = await orch.loadWorkflows(companyRoot)
				const environmentList = await orch.loadEnvironments(companyRoot)

				const agents = new Map(agentList.map((a) => [a.id, a]))
				const workflows = new Map(workflowList.map((w) => [w.id, w]))
				const environments = new Map(environmentList.map((e) => [e.id, e]))

				console.log(dim(`Loaded: ${agents.size} agents, ${workflows.size} workflows, ${environments.size} environments`))

				const defaults = {
					runtime: company.defaults.runtime ?? 'claude-code',
					workflow: company.defaults.workflow,
					task_assignee: company.defaults.task_assignee,
				}
				const engine = new orch.WorkflowEngine(
					{ company, agents, workflows, environments, providers: new Map(), capabilityProfiles: new Map(), defaults },
					null as never,
					null as never,
				)
				const issues = engine.validate()

				if (issues.length === 0) {
					console.log(badge('VALID', 'green') + ' All config references are consistent')
				} else {
					console.log(badge('ISSUES FOUND', 'red'))
					for (const issue of issues) {
						console.log(`  - ${issue}`)
					}
					process.exit(1)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(workflowsCmd)
