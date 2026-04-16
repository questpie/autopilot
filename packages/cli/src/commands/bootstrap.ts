/**
 * `autopilot bootstrap` — one-command setup for new Autopilot repos.
 *
 * Modes:
 *   local-first   Scaffold .autopilot/ and get running locally.
 *   join-existing  Connect to an existing orchestrator.
 *
 * Surfaces:
 *   claude-code   Claude Code + MCP (primary day-one surface).
 *   cli           CLI-only operator flow.
 */

import { Command } from 'commander'
import { existsSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { PATHS } from '@questpie/autopilot-spec'
import { program } from '../program'
import { brandHeader, success, dim, error, warning, section, dot } from '../utils/format'

// ─── Types ────────────────────────────────────────────────────────────────

type BootstrapMode = 'local-first' | 'join-existing'
type BootstrapSurface = 'claude-code' | 'cli'
type StarterWorkflow = 'bounded-dev' | 'simple'

interface BootstrapConfig {
	mode: BootstrapMode
	surface: BootstrapSurface
	companyName: string
	companySlug: string
	projectName: string
	workflow: StarterWorkflow
	runtime: string
	importContext: boolean
	repoRoot: string
}

// ─── Starter Templates ───────────────────────────────────────────────────

function companyYaml(config: BootstrapConfig): string {
	return stringifyYaml({
		name: config.companyName,
		slug: config.companySlug,
		description: '',
		timezone: 'UTC',
		language: 'en',
		owner: {},
		defaults: {
			runtime: config.runtime,
			workflow: config.workflow,
			task_assignee: 'dev',
		},
		context_hints: {
			specs: 'specs/',
			autopilot_docs: '.autopilot/docs/',
		},
		conversation_commands: {
			direct: {
				action: 'task.create',
				workflow_id: 'direct',
				type: 'task',
				title_template: '{{args}}',
				description_template: '{{args}}',
				instructions: 'Complete this as a direct one-shot work order from chat.',
			},
			build: {
				action: 'task.create',
				workflow_id: 'bounded-dev',
				type: 'feature',
				title_template: '{{args}}',
				description_template: '{{args}}\n\nThis work order was created from chat.',
				instructions: 'Treat this as implementation work. Inspect existing docs/workflows first.\nDo not create new primitives unless the existing ones do not fit.',
			},
			task: {
				action: 'task.create',
				workflow_id: 'bounded-dev',
				type: 'task',
				title_template: '{{args}}',
				description_template: '{{args}}',
			},
		},
	})
}

function projectYaml(config: BootstrapConfig): string {
	return stringifyYaml({
		name: config.projectName,
		description: '',
	})
}

function devAgentYaml(): string {
	return stringifyYaml({
		id: 'dev',
		name: 'Developer',
		role: 'developer',
		description: 'Implements features, fixes bugs, writes tests. Follows existing codebase patterns.',
	})
}

function boundedDevWorkflowYaml(): string {
	return `id: bounded-dev
name: "Bounded Development"
description: >
  Plan → implement → human review → done.
  A simple but safe development workflow with human approval.
workspace:
  mode: isolated_worktree
steps:
  - id: plan
    type: agent
    agent_id: dev
    instructions: >
      Research and create an implementation plan for the task.
      Analyze the codebase, identify affected files, dependencies, and risks.
      Produce a clear step-by-step plan. Do NOT implement yet.
    output:
      summary:
        description: "Brief plan summary"

  - id: implement
    type: agent
    agent_id: dev
    instructions: >
      Implement the task following the plan.
      Write clean, tested code. Run tests before completing.
      Follow existing codebase patterns. Stay within scope.
    output:
      summary:
        description: "Brief implementation summary"

  - id: review
    type: human_approval
    on_approve: done
    on_reply: implement
    on_reject: done

  - id: done
    type: done
`
}

function simpleWorkflowYaml(): string {
	return `id: simple
name: "Simple"
description: >
  Implement → human review → done.
  Minimal workflow for quick tasks.
workspace:
  mode: isolated_worktree
steps:
  - id: implement
    type: agent
    agent_id: dev
    instructions: >
      Implement the task. Write clean code, run tests, follow existing patterns.
    output:
      summary:
        description: "Brief summary of what was done"

  - id: review
    type: human_approval
    on_approve: done
    on_reply: implement
    on_reject: done

  - id: done
    type: done
`
}

function companyContextMd(config: BootstrapConfig): string {
	return `# ${config.companyName}

Add company-level context here: team structure, coding standards, architecture decisions, conventions.

This file is synced into CLAUDE.md by \`autopilot sync\`.
`
}

function projectContextMd(config: BootstrapConfig): string {
	return `# ${config.projectName}

Add project-specific context here: tech stack, key dependencies, folder structure, domain concepts.

This file is synced into CLAUDE.md by \`autopilot sync\`.
`
}

function operatorContextMd(): string {
	return `# Autopilot Operator Context

## Query vs Task

- **Query mode** (plain chat): read-only — answers questions, brainstorms, drafts text. Does NOT modify the repo.
- **Task / work order**: creates a durable task that runs a workflow. Use for any repo-mutating work.

## Conversation Commands

Available commands are configured in \`company.yaml\` under \`conversation_commands\`.

Default bootstrap commands:

| Command | Description |
|---------|-------------|
| \`/direct <prompt>\` | One-shot non-code work, no worktree |
| \`/build <prompt>\` | Code/config changes with isolated worktree |
| \`/task <prompt>\` | General task creation |

Commands are resolved by the orchestrator, not by chat handlers.
Any chat surface (Telegram, Discord, etc.) sends the command name and args;
the orchestrator looks up the configured action and creates the task.

Custom commands can be added to \`conversation_commands\` in \`company.yaml\`.

## Creating tasks from chat

Use \`/build <prompt>\` or \`/task <prompt>\` in chat to create work orders.
Tasks created from chat automatically bind results back to the originating conversation.

## Artifacts

- Unknown artifact kinds normalize to \`other\` with \`metadata.original_kind\`
- Use \`doc\` for text documents
- Use \`preview_file\` for HTML/file previews (preview URL is derived automatically)

## Provider/workflow installation

Provider and workflow setup is repo/config work — use \`/build\` or create a task with \`workflow_id: bounded-dev\`.
`
}

function docsReadmeMd(): string {
	return `# Autopilot Documentation

## Canonical Specs

- \`specs/autopilot/README.md\` — architecture overview and pass map
- \`specs/autopilot/current-steering.md\` — current truth and invariants
- \`specs/autopilot/primitive-roadmap.md\` — primitive layering and design guardrails

## Configuration

- \`.autopilot/company.yaml\` — company config
- \`.autopilot/project.yaml\` — project config
- \`.autopilot/agents/\` — agent definitions
- \`.autopilot/workflows/\` — workflow definitions
- \`.autopilot/handlers/\` — provider handler scripts
- \`.autopilot/context/\` — injected context files
`
}

function directWorkflowYaml(): string {
	return `id: direct
name: Direct one-shot work
description: Complete simple non-dev work directly. No worktree, no review.
workspace:
  mode: none
steps:
  - id: run
    type: agent
    agent_id: dev
    instructions: >
      Complete the task directly. Do not create code changes unless explicitly asked.
      If the result is small text, include it in the summary.
    output:
      summary:
        description: "Brief result summary"
  - id: done
    type: done
transitions:
  - from: run
    to: done
`
}

// ─── File Writing (never overwrite existing) ─────────────────────────────

interface WriteResult {
	created: string[]
	skipped: string[]
}

function safeWrite(filePath: string, content: string, result: WriteResult): void {
	const relative = filePath.includes('.autopilot')
		? filePath.slice(filePath.indexOf('.autopilot'))
		: basename(filePath)

	if (existsSync(filePath)) {
		result.skipped.push(relative)
		return
	}
	mkdirSync(dirname(filePath), { recursive: true })
	writeFileSync(filePath, content)
	result.created.push(relative)
}

// ─── Context Import ──────────────────────────────────────────────────────

function importContext(repoRoot: string, contextDir: string, result: WriteResult): void {
	const candidates = ['README.md', 'README', 'CLAUDE.md', 'AGENTS.md']

	for (const filename of candidates) {
		const src = join(repoRoot, filename)
		if (!existsSync(src)) continue

		const dest = join(contextDir, filename.toLowerCase())
		if (existsSync(dest)) {
			result.skipped.push(`.autopilot/context/${filename.toLowerCase()}`)
			continue
		}

		copyFileSync(src, dest)
		result.created.push(`.autopilot/context/${filename.toLowerCase()}`)
	}
}

// ─── Interactive Prompts ─────────────────────────────────────────────────

function askChoice<T extends string>(question: string, options: T[], defaultValue: T): T {
	const optStr = options.map((o) => (o === defaultValue ? `[${o}]` : o)).join(' / ')
	const answer = prompt(`${question} (${optStr}): `)
	if (!answer || !answer.trim()) return defaultValue
	const match = options.find((o) => o.startsWith(answer.trim().toLowerCase()))
	return match ?? defaultValue
}

function askString(question: string, defaultValue: string): string {
	const answer = prompt(`${question} [${defaultValue}]: `)
	return answer?.trim() || defaultValue
}

function askYesNo(question: string, defaultValue: boolean): boolean {
	const hint = defaultValue ? '[Y/n]' : '[y/N]'
	const answer = prompt(`${question} ${hint}: `)
	if (!answer || !answer.trim()) return defaultValue
	return answer.trim().toLowerCase().startsWith('y')
}

// ─── Slug Helper ─────────────────────────────────────────────────────────

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		|| 'my-company'
}

// ─── Bootstrap Logic ─────────────────────────────────────────────────────

function scaffoldLocalFirst(config: BootstrapConfig): WriteResult {
	const root = config.repoRoot
	const ap = join(root, PATHS.AUTOPILOT_DIR)
	const result: WriteResult = { created: [], skipped: [] }

	// Core config
	safeWrite(join(root, PATHS.COMPANY_CONFIG), companyYaml(config), result)
	safeWrite(join(root, PATHS.PROJECT_CONFIG), projectYaml(config), result)

	// Agent
	safeWrite(join(ap, 'agents', 'dev.yaml'), devAgentYaml(), result)

	// Workflow
	const workflowContent = config.workflow === 'bounded-dev' ? boundedDevWorkflowYaml() : simpleWorkflowYaml()
	safeWrite(join(ap, 'workflows', `${config.workflow}.yaml`), workflowContent, result)

	// Workflow: direct (always scaffold alongside the chosen workflow)
	safeWrite(join(ap, 'workflows', 'direct.yaml'), directWorkflowYaml(), result)

	// Context
	mkdirSync(join(ap, 'context'), { recursive: true })
	safeWrite(join(ap, 'context', 'company.md'), companyContextMd(config), result)
	safeWrite(join(ap, 'context', 'project.md'), projectContextMd(config), result)
	safeWrite(join(ap, 'context', 'autopilot-operator.md'), operatorContextMd(), result)

	// Docs
	safeWrite(join(ap, 'docs', 'README.md'), docsReadmeMd(), result)

	// Import existing repo context
	if (config.importContext) {
		importContext(root, join(ap, 'context'), result)
	}

	return result
}

function printNextSteps(config: BootstrapConfig): void {
	console.log('')
	console.log(section('Next Steps'))
	console.log('')

	if (config.mode === 'local-first') {
		console.log(`  ${dot('cyan')} ${dim('1.')} Run ${success('autopilot sync')} to generate CLAUDE.md, AGENTS.md, and sync skills`)
		console.log(`  ${dot('cyan')} ${dim('2.')} Run ${success('autopilot start')} to boot orchestrator + local worker`)
		console.log(`  ${dot('cyan')} ${dim('3.')} Run ${success('autopilot auth setup')} to create your operator account`)

		if (config.surface === 'claude-code') {
			console.log('')
			console.log(`  ${dot('yellow')} ${dim('Claude Code + MCP setup:')}`)
			console.log(`     Add to your project's .mcp.json:`)
			console.log(`     ${dim('{ "mcpServers": { "autopilot": { "command": "bunx", "args": ["@questpie/autopilot-mcp"] } } }')}`)
		}

		console.log('')
		console.log(`  ${dot('cyan')} ${dim('4.')} Create your first task: ${success('autopilot tasks create -t "My first task" --type feature')}`)
		console.log(`  ${dot('cyan')} ${dim('5.')} Check inbox and approve: ${success('autopilot inbox')}`)
	} else {
		console.log(`  ${dot('cyan')} ${dim('1.')} Log in: ${success('autopilot auth login --url <orchestrator-url>')}`)
		console.log(`     ${dim('(First-time owner? Use: autopilot auth setup --url <orchestrator-url>)')}`)
		console.log(`  ${dot('cyan')} ${dim('2.')} Obtain a join token from the orchestrator admin:`)
		console.log(`     ${dim('autopilot worker token create -d "my machine"')}`)
		console.log(`  ${dot('cyan')} ${dim('3.')} Start a worker with the token:`)
		console.log(`     ${success('autopilot worker start --url <orchestrator-url> --token <secret>')}`)
		console.log(`  ${dot('cyan')} ${dim('4.')} Run ${success('autopilot sync')} to generate local compatibility files`)
	}

	console.log('')
}

// ─── Command ─────────────────────────────────────────────────────────────

const bootstrapCmd = new Command('bootstrap')
	.description('Set up a new Autopilot project (interactive by default)')
	.option('--mode <mode>', 'Setup mode: local-first or join-existing')
	.option('--surface <surface>', 'Primary operator surface: claude-code or cli')
	.option('--company-name <name>', 'Company name')
	.option('--company-slug <slug>', 'Company slug (lowercase, hyphens)')
	.option('--project-name <name>', 'Project name')
	.option('--workflow <workflow>', 'Starter workflow: bounded-dev or simple')
	.option('--runtime <runtime>', 'Default runtime', 'claude-code')
	.option('--no-import-context', 'Skip importing existing repo context (README, CLAUDE.md)')
	.option('--yes', 'Accept all defaults (non-interactive)')
	.option('--cwd <dir>', 'Working directory (defaults to cwd)')
	.action(async (opts: {
		mode?: string
		surface?: string
		companyName?: string
		companySlug?: string
		projectName?: string
		workflow?: string
		runtime: string
		importContext: boolean
		yes?: boolean
		cwd?: string
	}) => {
		try {
			const repoRoot = resolve(opts.cwd ?? process.cwd())
			const dirName = basename(repoRoot)
			const nonInteractive = opts.yes === true

			console.log('')
			console.log(brandHeader('Bootstrap'))
			console.log('')

			// Check for existing .autopilot/
			const autopilotExists = existsSync(join(repoRoot, PATHS.AUTOPILOT_DIR))
			if (autopilotExists) {
				console.log(warning('.autopilot/ already exists. Existing files will NOT be overwritten.'))
				console.log('')
			}

			// ── Collect config (interactive or flags) ────────────────────
			const mode: BootstrapMode = (opts.mode as BootstrapMode) ??
				(nonInteractive ? 'local-first' : askChoice('Setup mode', ['local-first', 'join-existing'], 'local-first'))

			if (mode === 'join-existing') {
				// Thin join-existing path
				console.log('')
				console.log(dim('Join-existing mode: connect to a running orchestrator.'))
				console.log('')

				// Still scaffold .autopilot/ if missing so sync works
				if (!autopilotExists) {
					mkdirSync(join(repoRoot, PATHS.AUTOPILOT_DIR), { recursive: true })
					console.log(success(`Created ${PATHS.AUTOPILOT_DIR}/`))
				}

				printNextSteps({ mode, surface: 'cli', companyName: '', companySlug: '', projectName: '', workflow: 'simple', runtime: opts.runtime, importContext: false, repoRoot })
				return
			}

			// ── Local-first flow ─────────────────────────────────────────
			const surface: BootstrapSurface = (opts.surface as BootstrapSurface) ??
				(nonInteractive ? 'claude-code' : askChoice('Primary operator surface', ['claude-code', 'cli'], 'claude-code'))

			const companyName = opts.companyName ??
				(nonInteractive ? dirName : askString('Company name', dirName))

			const companySlug = opts.companySlug ??
				(nonInteractive ? toSlug(companyName) : askString('Company slug', toSlug(companyName)))

			const projectName = opts.projectName ??
				(nonInteractive ? dirName : askString('Project name', dirName))

			const workflow: StarterWorkflow = (opts.workflow as StarterWorkflow) ??
				(nonInteractive ? 'bounded-dev' : askChoice('Starter workflow', ['bounded-dev', 'simple'], 'bounded-dev'))

			const importCtx = opts.importContext !== false &&
				(nonInteractive || askYesNo('Import existing context (README, CLAUDE.md)?', true))

			const config: BootstrapConfig = {
				mode,
				surface,
				companyName,
				companySlug,
				projectName,
				workflow,
				runtime: opts.runtime,
				importContext: importCtx,
				repoRoot,
			}

			// ── Scaffold ─────────────────────────────────────────────────
			console.log('')
			const result = scaffoldLocalFirst(config)

			if (result.created.length > 0) {
				console.log(section('Created'))
				for (const f of result.created) {
					console.log(`  ${dot('green')} ${f}`)
				}
			}

			if (result.skipped.length > 0) {
				console.log('')
				console.log(dim('Skipped (already exist):'))
				for (const f of result.skipped) {
					console.log(`  ${dim(f)}`)
				}
			}

			// ── Next steps ───────────────────────────────────────────────
			printNextSteps(config)

		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

program.addCommand(bootstrapCmd)
