import { agentsMd, mcp, skill } from 'agent-install'
import { type McpAgentType, type McpRemoteTransport, isMcpAgentType } from 'agent-install/mcp'
import { type InstallMode, type SkillAgentType, isSkillAgentType } from 'agent-install/skill'
import { Command } from 'commander'
import { program } from '../program'
import { dim, error, section, success, warning } from '../utils/format'

type AgentsMdAgent =
	| 'claude-code'
	| 'cursor'
	| 'codex'
	| 'gemini-cli'
	| 'windsurf'
	| 'opencode'
	| 'aider'
	| 'universal'

function normalizeList(values?: string[]): string[] | undefined {
	const out = values
		?.flatMap((value) => value.split(','))
		.map((value) => value.trim())
		.filter(Boolean)
	return out && out.length > 0 ? out : undefined
}

function parseSkillAgents(values?: string[]): SkillAgentType[] | undefined {
	const agents = normalizeList(values)
	if (!agents) return undefined
	for (const agent of agents) {
		if (!isSkillAgentType(agent)) {
			throw new Error(`Unsupported skill agent "${agent}"`)
		}
	}
	return agents as SkillAgentType[]
}

function parseMcpAgents(values?: string[]): McpAgentType[] | undefined {
	const agents = normalizeList(values)
	if (!agents) return undefined
	for (const agent of agents) {
		if (!isMcpAgentType(agent)) {
			throw new Error(`Unsupported MCP agent "${agent}"`)
		}
	}
	return agents as McpAgentType[]
}

function parseAgentsMdAgent(agent?: string): AgentsMdAgent | undefined {
	if (!agent) return undefined
	const supported: AgentsMdAgent[] = [
		'claude-code',
		'cursor',
		'codex',
		'gemini-cli',
		'windsurf',
		'opencode',
		'aider',
		'universal',
	]
	if (!supported.includes(agent as AgentsMdAgent)) {
		throw new Error(`Unsupported AGENTS.md agent "${agent}"`)
	}
	return agent as AgentsMdAgent
}

function parseTransport(value?: string): McpRemoteTransport | undefined {
	if (!value) return undefined
	if (value !== 'http' && value !== 'sse') {
		throw new Error(`Unsupported MCP transport "${value}". Use http or sse.`)
	}
	return value
}

function parseEnv(values?: string[]): Record<string, string> | undefined {
	const entries = normalizeList(values)
	if (!entries) return undefined

	const env: Record<string, string> = {}
	for (const entry of entries) {
		const idx = entry.indexOf('=')
		if (idx <= 0) throw new Error(`Invalid env entry "${entry}". Use KEY=VALUE.`)
		env[entry.slice(0, idx)] = entry.slice(idx + 1)
	}
	return env
}

const agentCmd = new Command('agent').description(
	'Install skills, MCP servers, and AGENTS.md guidance for local coding agents',
)

const agentSkillCmd = new Command('skill').description(
	'Install SKILL.md packages with agent-install',
)

agentSkillCmd.addCommand(
	new Command('add')
		.description(
			'Install one or more SKILL.md files from a local path, git repo, GitHub shorthand, URL, or well-known endpoint',
		)
		.argument(
			'<source>',
			'Skill source, e.g. owner/repo, ./skills/foo, or https://example.com/SKILL.md',
		)
		.option('-a, --agent <agent...>', 'Target coding agent(s), e.g. claude-code codex cursor')
		.option('--global', 'Install into global agent config instead of the project')
		.option('--copy', 'Copy skills instead of symlinking when possible')
		.option('--cwd <dir>', 'Project directory for project-scoped installs')
		.action(
			async (
				source: string,
				opts: { agent?: string[]; global?: boolean; copy?: boolean; cwd?: string },
			) => {
				try {
					const mode: InstallMode = opts.copy ? 'copy' : 'symlink'
					const result = await skill.add({
						source,
						agents: parseSkillAgents(opts.agent),
						global: opts.global,
						cwd: opts.cwd,
						mode,
					})

					console.log(section(`Installed skills (${result.installed.length})`))
					for (const record of result.installed) {
						console.log(`  ${success(record.skill)} ${dim(`-> ${record.agent} (${record.path})`)}`)
					}

					if (result.failed.length > 0) {
						console.log('')
						console.log(warning(`Failed (${result.failed.length})`))
						for (const failed of result.failed) {
							console.log(`  ${failed.skill} ${dim(`-> ${failed.agent}: ${failed.error}`)}`)
						}
					}
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

const agentMcpCmd = new Command('mcp').description('Install MCP servers with agent-install')

agentMcpCmd.addCommand(
	new Command('add')
		.description('Install an MCP server into local coding agent config')
		.argument('<source>', 'MCP source: remote URL, npm package, or raw command')
		.option('--name <name>', 'Server name')
		.option('-a, --agent <agent...>', 'Target coding agent(s), e.g. claude-code codex cursor')
		.option('--transport <transport>', 'Remote transport: http or sse')
		.option('--env <keyValue...>', 'Environment values as KEY=VALUE')
		.option('--global', 'Install into global agent config instead of the project')
		.option('--cwd <dir>', 'Project directory for project-scoped installs')
		.action(
			async (
				source: string,
				opts: {
					name?: string
					agent?: string[]
					transport?: string
					env?: string[]
					global?: boolean
					cwd?: string
				},
			) => {
				try {
					const result = await mcp.add({
						source,
						name: opts.name,
						agents: parseMcpAgents(opts.agent),
						transport: parseTransport(opts.transport),
						env: parseEnv(opts.env),
						global: opts.global,
						cwd: opts.cwd,
					})

					console.log(section(`Installed MCP server: ${result.serverName}`))
					for (const record of result.results) {
						const status = record.success ? success('ok') : warning('failed')
						console.log(
							`  ${status} ${record.agent} ${dim(record.path)}${record.error ? ` ${dim(record.error)}` : ''}`,
						)
					}
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

const guideCmd = new Command('guide').description('Write AGENTS.md sections with agent-install')

guideCmd.addCommand(
	new Command('set-section')
		.description('Upsert a section in AGENTS.md or an agent-specific guidance file')
		.argument('<heading>', 'Section heading')
		.requiredOption('--body <body>', 'Section body markdown')
		.option('-a, --agent <agent>', 'Target guide file agent, e.g. universal, claude-code, codex')
		.option('--cwd <dir>', 'Project directory')
		.action(async (heading: string, opts: { body: string; agent?: string; cwd?: string }) => {
			try {
				const path = agentsMd.setSection({
					heading,
					body: opts.body,
					agent: parseAgentsMdAgent(opts.agent),
					cwd: opts.cwd,
				})
				console.log(success(`Updated ${path}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

agentCmd.addCommand(agentSkillCmd)
agentCmd.addCommand(agentMcpCmd)
agentCmd.addCommand(guideCmd)

program.addCommand(agentCmd)
