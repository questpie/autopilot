import { z } from 'zod'
import { resolve, relative, dirname } from 'node:path'
import { realpath } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import type { ToolDefinition, ToolResult } from '../tools'
import { isDeniedPath } from '../../auth/deny-patterns'
import { checkScope } from '../../auth/permissions'
import type { Actor } from '../../auth/types'

// ─── Context & types ──────────────────────────────────────────────────────

export interface FileToolContext {
	companyRoot: string
	agentId: string
	/** Agent fs_scope for permission enforcement */
	scope?: { fsRead?: string[]; fsWrite?: string[] }
}

interface PathValidation {
	ok: boolean
	error?: string
	resolved?: string
}

// ─── Security helpers ─────────────────────────────────────────────────────

function buildActor(ctx: FileToolContext): Actor {
	return {
		id: ctx.agentId,
		type: 'agent',
		name: ctx.agentId,
		role: 'agent',
		permissions: {},
		scope: ctx.scope
			? { fsRead: ctx.scope.fsRead, fsWrite: ctx.scope.fsWrite }
			: undefined,
		source: 'internal',
	}
}

async function validatePath(
	companyRoot: string,
	relativePath: string,
	mode: 'read' | 'write',
	scope?: FileToolContext['scope'],
): Promise<PathValidation> {
	const resolved = resolve(companyRoot, relativePath)
	const rel = relative(companyRoot, resolved)

	// Prevent traversal (pre-realpath check for obvious cases)
	if (rel.startsWith('..') || resolve(resolved) === resolve(companyRoot, '..')) {
		return { ok: false, error: 'Path outside company root' }
	}

	// D3: Resolve symlinks to prevent symlink-based traversal
	try {
		const realResolved = await realpath(resolved)
		const realRoot = await realpath(companyRoot)
		const realRel = relative(realRoot, realResolved)
		if (realRel.startsWith('..')) {
			return { ok: false, error: 'Path outside company root (symlink)' }
		}
	} catch {
		// File doesn't exist yet (write) — fall through to logical check only
	}

	// Hardcoded deny
	if (isDeniedPath(rel)) {
		return { ok: false, error: `Access denied: ${rel}` }
	}

	// Scope check
	const actor = buildActor({ companyRoot, agentId: 'file-tool', scope })
	const resourceType = mode === 'read' ? 'fs_read' : 'fs_write'
	if (!checkScope(actor, resourceType, rel)) {
		return { ok: false, error: `${mode} not allowed by agent scope: ${rel}` }
	}

	return { ok: true, resolved }
}

function textResult(text: string, isError?: boolean): ToolResult {
	return { content: [{ type: 'text', text }], isError }
}

// ─── Tool factory ─────────────────────────────────────────────────────────

export function createFileTools(ctx: FileToolContext): ToolDefinition[] {
	const { companyRoot, scope } = ctx

	// ── readFile ───────────────────────────────────────────────────────────
	const readFile: ToolDefinition = {
		name: 'readFile',
		description:
			'Read a file from the project. Optionally specify offset (line number to start) and limit (number of lines).',
		schema: z.object({
			path: z.string().describe('Relative path from project root'),
			offset: z.number().int().min(0).optional().describe('Line offset (0-based)'),
			limit: z.number().int().min(1).optional().describe('Max lines to return'),
		}),
		execute: async (args) => {
			const v = await validatePath(companyRoot, args.path, 'read', scope)
			if (!v.ok) return textResult(v.error!, true)

			try {
				const file = Bun.file(v.resolved!)
				if (!(await file.exists())) {
					return textResult(`File not found: ${args.path}`, true)
				}
				let text = await file.text()

				if (args.offset !== undefined || args.limit !== undefined) {
					const lines = text.split('\n')
					const start = args.offset ?? 0
					const end = args.limit !== undefined ? start + args.limit : lines.length
					text = lines.slice(start, end).join('\n')
				}

				return textResult(text)
			} catch (err) {
				return textResult(`Error reading file: ${err instanceof Error ? err.message : String(err)}`, true)
			}
		},
	}

	// ── writeFile ─────────────────────────────────────────────────────────
	const writeFile: ToolDefinition = {
		name: 'writeFile',
		description: 'Write content to a file. Creates parent directories if needed.',
		schema: z.object({
			path: z.string().describe('Relative path from project root'),
			content: z.string().describe('File content to write'),
		}),
		execute: async (args) => {
			const v = await validatePath(companyRoot, args.path, 'write', scope)
			if (!v.ok) return textResult(v.error!, true)

			try {
				const dir = dirname(v.resolved!)
				const { mkdir } = await import('node:fs/promises')
				await mkdir(dir, { recursive: true })

				await Bun.write(v.resolved!, args.content)
				return textResult(`Wrote ${args.content.length} chars to ${args.path}`)
			} catch (err) {
				return textResult(`Error writing file: ${err instanceof Error ? err.message : String(err)}`, true)
			}
		},
	}

	// ── editFile ──────────────────────────────────────────────────────────
	const editFile: ToolDefinition = {
		name: 'editFile',
		description:
			'Edit a file by replacing an exact string. Fails if old_string is not found or not unique (unless replace_all is true).',
		schema: z.object({
			path: z.string().describe('Relative path from project root'),
			old_string: z.string().describe('Exact string to find'),
			new_string: z.string().describe('Replacement string'),
			replace_all: z.boolean().optional().describe('Replace all occurrences (default: false)'),
		}),
		execute: async (args) => {
			const v = await validatePath(companyRoot, args.path, 'write', scope)
			if (!v.ok) return textResult(v.error!, true)

			try {
				const file = Bun.file(v.resolved!)
				if (!(await file.exists())) {
					return textResult(`File not found: ${args.path}`, true)
				}

				const content = await file.text()
				const occurrences = content.split(args.old_string).length - 1

				if (occurrences === 0) {
					return textResult('old_string not found in file', true)
				}
				if (!args.replace_all && occurrences > 1) {
					return textResult(
						`old_string found ${occurrences} times — provide more context to make it unique, or set replace_all: true`,
						true,
					)
				}

				const updated = args.replace_all
					? content.replaceAll(args.old_string, args.new_string)
					: content.replace(args.old_string, args.new_string)

				await Bun.write(v.resolved!, updated)
				return textResult(
					`Replaced ${args.replace_all ? occurrences : 1} occurrence(s) in ${args.path}`,
				)
			} catch (err) {
				return textResult(`Error editing file: ${err instanceof Error ? err.message : String(err)}`, true)
			}
		},
	}

	// ── bash ──────────────────────────────────────────────────────────────

	// D1: Only these env vars are passed to bash subprocesses
	const ALLOWED_ENV_VARS = ['PATH', 'HOME', 'USER', 'LANG', 'TERM', 'SHELL'] as const
	const bashEnv: Record<string, string> = {}
	for (const key of ALLOWED_ENV_VARS) {
		if (process.env[key]) bashEnv[key] = process.env[key]!
	}

	// D2: Block network commands to prevent SSRF / data exfiltration
	const BLOCKED_NETWORK_CMDS = /\b(curl|wget|nc|ncat|netcat|socat|ssh|scp|sftp|telnet|ftp|rsync)\b/

	const bash: ToolDefinition = {
		name: 'bash',
		description:
			'Execute a shell command in the project root. Returns stdout + stderr. Default timeout 120s, output capped at 50k chars. Network commands (curl, wget, nc, ssh, etc.) are blocked.',
		schema: z.object({
			command: z.string().describe('Shell command to execute'),
			timeout: z.number().int().min(1000).optional().describe('Timeout in ms (default 120000)'),
		}),
		execute: async (args) => {
			// D2: Block network commands
			if (BLOCKED_NETWORK_CMDS.test(args.command)) {
				return textResult(
					'Blocked: network commands (curl, wget, nc, ssh, etc.) are not allowed in bash tool',
					true,
				)
			}

			const timeoutMs = args.timeout ?? 120_000
			const maxOutput = 50_000

			return new Promise<ToolResult>((res) => {
				const proc = spawn('bash', ['--norc', '--noprofile', '-c', args.command], {
					cwd: companyRoot,
					timeout: timeoutMs,
					env: bashEnv,
				})

				let stdout = ''
				let stderr = ''

				proc.stdout?.on('data', (d: Buffer) => {
					stdout += d.toString()
				})
				proc.stderr?.on('data', (d: Buffer) => {
					stderr += d.toString()
				})

				proc.on('close', (code) => {
					let output = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '')
					if (output.length > maxOutput) {
						output = output.slice(0, maxOutput) + '\n... [truncated]'
					}
					if (code !== 0) {
						output = `Exit code: ${code}\n${output}`
					}
					res(textResult(output, code !== 0 && code !== null))
				})

				proc.on('error', (err) => {
					res(textResult(`Command error: ${err.message}`, true))
				})
			})
		},
	}

	// ── glob ──────────────────────────────────────────────────────────────
	const glob: ToolDefinition = {
		name: 'glob',
		description: 'Find files matching a glob pattern in the project.',
		schema: z.object({
			pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
			path: z.string().optional().describe('Subdirectory to search (default: project root)'),
		}),
		execute: async (args) => {
			const basePath = args.path ?? '.'
			const v = await validatePath(companyRoot, basePath, 'read', scope)
			if (!v.ok) return textResult(v.error!, true)

			try {
				const g = new Bun.Glob(args.pattern)
				const results: string[] = []
				for await (const match of g.scan({ cwd: v.resolved!, dot: false })) {
					results.push(match)
					if (results.length >= 1000) break
				}

				if (results.length === 0) {
					return textResult('No files matched')
				}
				return textResult(results.join('\n'))
			} catch (err) {
				return textResult(`Glob error: ${err instanceof Error ? err.message : String(err)}`, true)
			}
		},
	}

	// ── grep ──────────────────────────────────────────────────────────────
	const grep: ToolDefinition = {
		name: 'grep',
		description:
			'Search file contents using ripgrep (rg). Falls back to grep -rn if rg is unavailable.',
		schema: z.object({
			pattern: z.string().describe('Search regex pattern'),
			path: z.string().optional().describe('Subdirectory to search (default: project root)'),
			glob: z.string().optional().describe('File glob filter (e.g. "*.ts")'),
			max_results: z.number().int().min(1).optional().describe('Max results (default 100)'),
		}),
		execute: async (args) => {
			const basePath = args.path ?? '.'
			const v = await validatePath(companyRoot, basePath, 'read', scope)
			if (!v.ok) return textResult(v.error!, true)

			const maxResults = args.max_results ?? 100

			return new Promise<ToolResult>((res) => {
				// Try ripgrep first, fallback to grep
				const rgArgs = [
					'-n',
					'--max-count', String(maxResults),
					...(args.glob ? ['--glob', args.glob] : []),
					args.pattern,
					v.resolved!,
				]

				const proc = spawn('rg', rgArgs, {
					cwd: companyRoot,
					timeout: 30_000,
				})

				let output = ''
				proc.stdout?.on('data', (d: Buffer) => {
					output += d.toString()
				})
				proc.stderr?.on('data', (d: Buffer) => {
					output += d.toString()
				})

				proc.on('close', (code) => {
					if (output.length > 50_000) {
						output = output.slice(0, 50_000) + '\n... [truncated]'
					}
					// rg returns 1 when no matches found — not an error
					if (code === 1 && output.trim() === '') {
						res(textResult('No matches found'))
					} else {
						res(textResult(output || 'No matches found'))
					}
				})

				proc.on('error', () => {
					// rg not available, fallback to grep
					const grepArgs = ['-rn', args.pattern, v.resolved!]
					if (args.glob) {
						grepArgs.splice(1, 0, '--include', args.glob)
					}

					const fallback = spawn('grep', grepArgs, {
						cwd: companyRoot,
						timeout: 30_000,
					})

					let grepOutput = ''
					fallback.stdout?.on('data', (d: Buffer) => {
						grepOutput += d.toString()
					})
					fallback.stderr?.on('data', (d: Buffer) => {
						grepOutput += d.toString()
					})

					fallback.on('close', () => {
						if (grepOutput.length > 50_000) {
							grepOutput = grepOutput.slice(0, 50_000) + '\n... [truncated]'
						}
						res(textResult(grepOutput || 'No matches found'))
					})

					fallback.on('error', (err) => {
						res(textResult(`Search error: ${err.message}`, true))
					})
				})
			})
		},
	}

	return [readFile, writeFile, editFile, bash, glob, grep]
}
