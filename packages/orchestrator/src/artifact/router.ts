import { join } from 'path'
import { parse } from 'yaml'

/** Configuration stored in `.artifact.yaml` inside each artifact directory. */
export interface ArtifactConfig {
	name: string
	serve: string
	build?: string
	health?: string
	timeout?: string
}

/** Public view of a running artifact process. */
export interface ArtifactProcess {
	id: string
	port: number
	pid: number
	startedAt: Date
	config: ArtifactConfig
}

interface RunningProcess {
	process: { pid: number; kill: () => void }
	port: number
	config: ArtifactConfig
	startedAt: Date
}

function parseTimeout(timeout: string): number {
	const match = timeout.match(/^(\d+)(ms|s|m|h)$/)
	if (!match) return 300_000
	const value = parseInt(match[1]!, 10)
	switch (match[2]) {
		case 'ms':
			return value
		case 's':
			return value * 1000
		case 'm':
			return value * 60_000
		case 'h':
			return value * 3_600_000
		default:
			return 300_000
	}
}

/**
 * Manages artifact dev-server processes with cold-start and idle-timeout.
 *
 * Each artifact is a directory under `<companyRoot>/artifacts/<id>/` with
 * an `.artifact.yaml` config. The router allocates a port from a pool
 * (4100-4199), runs the `build` + `serve` commands, waits for health, and
 * tears the process down after an idle timeout.
 */
export class ArtifactRouter {
	private processes: Map<string, RunningProcess> = new Map()
	private idleTimers: Map<string, Timer> = new Map()
	private nextPort = 4100

	constructor(private companyRoot: string) {}

	/**
	 * Get the URL for an artifact, cold-starting it if necessary.
	 *
	 * Resets the idle timer on every call so frequently-accessed artifacts
	 * stay alive.
	 */
	async route(artifactId: string): Promise<{ port: number; url: string }> {
		let proc = this.processes.get(artifactId)
		if (!proc) {
			const artifactProcess = await this.coldStart(artifactId)
			proc = this.processes.get(artifactId)!
			void artifactProcess
		}
		this.resetIdleTimer(artifactId)
		return { port: proc.port, url: `http://localhost:${proc.port}` }
	}

	/** Kill a running artifact process and release its port. */
	async stop(artifactId: string): Promise<void> {
		const proc = this.processes.get(artifactId)
		if (!proc) return
		try {
			proc.process.kill()
		} catch {
			// process may already be dead
		}
		this.processes.delete(artifactId)
		const timer = this.idleTimers.get(artifactId)
		if (timer) {
			clearTimeout(timer)
			this.idleTimers.delete(artifactId)
		}
	}

	/** Stop every running artifact process. */
	async stopAll(): Promise<void> {
		const ids = [...this.processes.keys()]
		await Promise.all(ids.map((id) => this.stop(id)))
	}

	/** List all currently running artifact processes. */
	list(): ArtifactProcess[] {
		return [...this.processes.entries()].map(([id, proc]) => ({
			id,
			port: proc.port,
			pid: proc.process.pid,
			startedAt: proc.startedAt,
			config: proc.config,
		}))
	}

	private async coldStart(artifactId: string): Promise<ArtifactProcess> {
		const config = await this.readConfig(artifactId)
		const port = this.allocatePort()
		const artifactDir = join(this.companyRoot, 'artifacts', artifactId)

		if (config.build) {
			const buildParts = config.build.split(' ')
			const buildProc = Bun.spawn(buildParts, {
				cwd: artifactDir,
				stdout: 'ignore',
				stderr: 'ignore',
			})
			await buildProc.exited
		}

		const serveCmd = config.serve.replace('{port}', String(port))
		const serveParts = serveCmd.split(' ')
		const proc = Bun.spawn(serveParts, {
			cwd: artifactDir,
			stdout: 'ignore',
			stderr: 'ignore',
		})

		const healthPath = config.health ?? '/'
		const healthUrl = `http://localhost:${port}${healthPath}`
		await this.waitForHealth(healthUrl)

		const running: RunningProcess = {
			process: { pid: proc.pid, kill: () => proc.kill() },
			port,
			config,
			startedAt: new Date(),
		}
		this.processes.set(artifactId, running)
		this.resetIdleTimer(artifactId)

		return {
			id: artifactId,
			port,
			pid: proc.pid,
			startedAt: running.startedAt,
			config,
		}
	}

	private resetIdleTimer(artifactId: string): void {
		const existing = this.idleTimers.get(artifactId)
		if (existing) clearTimeout(existing)

		const proc = this.processes.get(artifactId)
		if (!proc) return

		const timeout = parseTimeout(proc.config.timeout ?? '5m')
		const timer = setTimeout(() => {
			void this.stop(artifactId)
		}, timeout)
		this.idleTimers.set(artifactId, timer)
	}

	async readConfig(artifactId: string): Promise<ArtifactConfig> {
		const configPath = join(this.companyRoot, 'artifacts', artifactId, '.artifact.yaml')
		const content = await Bun.file(configPath).text()
		return parse(content) as ArtifactConfig
	}

	allocatePort(): number {
		const port = this.nextPort
		this.nextPort++
		if (this.nextPort > 4199) {
			this.nextPort = 4100
		}
		return port
	}

	private async waitForHealth(url: string, maxRetries = 30, intervalMs = 100): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				const res = await fetch(url)
				if (res.ok) return
			} catch {
				// not ready yet
			}
			await new Promise((resolve) => setTimeout(resolve, intervalMs))
		}
		throw new Error(`Health check failed for ${url} after ${maxRetries} retries`)
	}
}
