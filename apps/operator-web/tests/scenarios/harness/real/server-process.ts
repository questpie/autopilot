import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { appRoot } from "./run-context";
import { createRunEvidence, redact, registerSecret, type RunEvidence } from "./run-evidence";

const RESERVED_PORTS = new Set([3000, 6006, 6007]);
const PORT_ALLOCATION_ATTEMPTS = 20;
const HEALTH_READY_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 250;
const SIGTERM_GRACE_MS = 5_000;
const PORT_RELEASE_TIMEOUT_MS = 5_000;
const MAX_BOOT_ATTEMPTS = 3;
const RING_BUFFER_MAX_LINES = 1_000;
const ERROR_TAIL_LINES = 20;

/** Documented stop semantics — also carried verbatim into the run.json manifest. */
export const KILL_SEMANTICS = {
	stopSignal: "SIGTERM",
	graceMs: SIGTERM_GRACE_MS,
	fallbackSignal: "SIGKILL",
	testEnv: "TEST=1 disables the srvx graceful-shutdown plugin in the built bundle",
} as const;

type ServerChild = ReturnType<typeof spawnServer>;

/** Registry of live children; the exit hook is the best-effort net for harness crashes. */
const liveChildren = new Map<number, ServerChild>();
let exitHookInstalled = false;

const installExitHook = (): void => {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	process.on("exit", () => {
		for (const child of liveChildren.values()) {
			try {
				child.kill("SIGKILL");
			} catch {
				// child already gone
			}
		}
	});
};

/** Free ephemeral port via a Bun.serve probe; 3000/6006/6007 are never handed out. */
export const allocatePort = (): number => {
	for (let attempt = 0; attempt < PORT_ALLOCATION_ATTEMPTS; attempt += 1) {
		const probe = Bun.serve({ port: 0, fetch: () => new Response("port-probe") });
		const port = probe.port;
		probe.stop(true);
		if (port !== undefined && !RESERVED_PORTS.has(port)) return port;
	}
	throw new Error(
		`allocatePort: no free non-reserved port after ${PORT_ALLOCATION_ATTEMPTS} probes`,
	);
};

const isTcpRefused = async (port: number): Promise<boolean> => {
	try {
		const socket = await Bun.connect({
			hostname: "127.0.0.1",
			port,
			socket: { data: () => undefined },
		});
		socket.end();
		return false;
	} catch {
		return true;
	}
};

type LogSink = {
	push: (tag: "stdout" | "stderr" | "note", line: string) => void;
	tail: (count?: number) => string[];
};

/** Every pushed line passes value-level redact() before the ring AND the evidence file. */
const createLogSink = (evidenceDir?: string): LogSink => {
	const ring: string[] = [];
	const evidenceFile = evidenceDir ? join(evidenceDir, "server.log") : null;
	if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
	return {
		push: (tag, line) => {
			const entry = `[${tag}] ${redact(line)}`;
			ring.push(entry);
			if (ring.length > RING_BUFFER_MAX_LINES) ring.splice(0, ring.length - RING_BUFFER_MAX_LINES);
			if (evidenceFile) {
				try {
					appendFileSync(evidenceFile, `${entry}\n`);
				} catch {
					// evidence sink is best-effort; the ring buffer stays authoritative
				}
			}
		},
		tail: (count = ERROR_TAIL_LINES) => ring.slice(-count),
	};
};

const teeStream = async (
	stream: ReadableStream<Uint8Array>,
	tag: "stdout" | "stderr",
	sink: LogSink,
): Promise<void> => {
	const decoder = new TextDecoder();
	let pending = "";
	for await (const chunk of stream) {
		pending += decoder.decode(chunk, { stream: true });
		const lines = pending.split("\n");
		pending = lines.pop() ?? "";
		for (const line of lines) sink.push(tag, line);
	}
	pending += decoder.decode();
	if (pending) sink.push(tag, pending);
};

type SpawnServerOptions = {
	port: number;
	databaseUrl: string;
	betterAuthSecret: string;
};

/**
 * Child env is built from scratch (allowlist) — never spread process.env — so
 * NITRO_ and QUESTPIE_ vars and dev credentials cannot leak into the server under test.
 * TEST=1 disables the srvx graceful-shutdown plugin in the built bundle, making
 * SIGTERM immediate and identical local/CI. APP_URL must equal the served origin
 * exactly (Better Auth trustedOrigins + channel origin validation derive from it).
 */
const spawnServer = (options: SpawnServerOptions) =>
	Bun.spawn(["bun", "--no-env-file", "run", ".output/server/index.mjs"], {
		cwd: appRoot,
		env: {
			PATH: process.env.PATH ?? "",
			HOME: process.env.HOME ?? "",
			TMPDIR: process.env.TMPDIR ?? "",
			NODE_ENV: "production",
			TEST: "1",
			PORT: String(options.port),
			APP_URL: `http://localhost:${options.port}`,
			DATABASE_URL: options.databaseUrl,
			BETTER_AUTH_SECRET: options.betterAuthSecret,
			MAIL_ADAPTER: "console",
		},
		stdout: "pipe",
		stderr: "pipe",
	});

type ReadyOutcome = "ready" | { earlyExitCode: number | null } | "timeout";

/** Readiness IS the health poll: the first 200 proves lazy QUESTPIE init incl. DB connect. */
const awaitReady = async (child: ServerChild, port: number): Promise<ReadyOutcome> => {
	let exited = false;
	let exitCode: number | null = null;
	void child.exited
		.then((code) => {
			exited = true;
			exitCode = code;
		})
		.catch(() => {
			exited = true;
		});
	const deadline = Date.now() + HEALTH_READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (exited) return { earlyExitCode: exitCode };
		try {
			const response = await fetch(`http://localhost:${port}/api/health`, {
				signal: AbortSignal.timeout(2_000),
			});
			await response.arrayBuffer();
			if (response.status === 200) return "ready";
		} catch {
			// not accepting yet — keep polling until the deadline
		}
		await Bun.sleep(HEALTH_POLL_INTERVAL_MS);
	}
	return "timeout";
};

export type StartServerOptions = {
	databaseUrl: string;
	/** When set, the stdout/stderr tee also appends to <evidenceDir>/server.log. */
	evidenceDir?: string;
	/** Defaults to a fresh per-run random secret. */
	betterAuthSecret?: string;
};

export type StartedServer = {
	port: number;
	baseUrl: string;
	databaseUrl: string;
	betterAuthSecret: string;
	/** Pid of the live child, or undefined once stopped. */
	pid: () => number | undefined;
	/** Most recent ring-buffer lines (stdout+stderr interleaved). */
	logTail: (count?: number) => string[];
	/** Pushes a harness note through the SAME redacting server-log sink. */
	logNote: (line: string) => void;
	/** SIGTERM, <=5s grace, SIGKILL fallback; resolves only once the port refuses TCP. */
	stop: () => Promise<void>;
	/** Boots again on the SAME port and database (cross-process durability lever). */
	restart: () => Promise<void>;
};

const bootChild = (options: SpawnServerOptions, sink: LogSink): ServerChild => {
	installExitHook();
	const child = spawnServer(options);
	liveChildren.set(child.pid, child);
	void teeStream(child.stdout, "stdout", sink).catch(() => undefined);
	void teeStream(child.stderr, "stderr", sink).catch(() => undefined);
	return child;
};

const killHard = (child: ServerChild): void => {
	liveChildren.delete(child.pid);
	try {
		child.kill("SIGKILL");
	} catch {
		// already gone
	}
};

const stopChild = async (child: ServerChild, port: number): Promise<void> => {
	liveChildren.delete(child.pid);
	try {
		child.kill("SIGTERM");
	} catch {
		// already gone
	}
	const killTimer = setTimeout(() => {
		try {
			child.kill("SIGKILL");
		} catch {
			// already gone
		}
	}, SIGTERM_GRACE_MS);
	await child.exited;
	clearTimeout(killTimer);
	const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
	while (!(await isTcpRefused(port))) {
		if (Date.now() > deadline) {
			throw new Error(`stop(): port ${port} still accepting connections after server exit`);
		}
		await Bun.sleep(100);
	}
};

/**
 * Boots the built production server (`bun run build` first — the test:scenario-harness
 * script does this) against the given disposable database on a fresh non-reserved port.
 */
export const startServer = async (options: StartServerOptions): Promise<StartedServer> => {
	const sink = createLogSink(options.evidenceDir);
	const evidence: RunEvidence | null = options.evidenceDir
		? createRunEvidence(options.evidenceDir)
		: null;
	const betterAuthSecret = options.betterAuthSecret ?? `harness-${crypto.randomUUID()}`;
	registerSecret(betterAuthSecret);

	const boot = async (fixedPort?: number): Promise<{ child: ServerChild; port: number }> => {
		for (let attempt = 1; attempt <= MAX_BOOT_ATTEMPTS; attempt += 1) {
			const port = fixedPort ?? allocatePort();
			const child = bootChild({ port, databaseUrl: options.databaseUrl, betterAuthSecret }, sink);
			const outcome = await awaitReady(child, port);
			if (outcome === "ready") return { child, port };
			killHard(child);
			const tail = sink.tail().join("\n");
			if (outcome === "timeout") {
				throw new Error(
					`Server on port ${port} did not answer /api/health 200 within ${HEALTH_READY_TIMEOUT_MS}ms:\n${tail}`,
				);
			}
			const retryable =
				fixedPort === undefined && tail.includes("EADDRINUSE") && attempt < MAX_BOOT_ATTEMPTS;
			if (!retryable) {
				throw new Error(
					`Server exited (code ${outcome.earlyExitCode}) on port ${port} before ready:\n${tail}`,
				);
			}
		}
		throw new Error(
			`Server boot failed after ${MAX_BOOT_ATTEMPTS} EADDRINUSE retries:\n${sink.tail().join("\n")}`,
		);
	};

	const first = await boot();
	let child = first.child;
	const port = first.port;
	let running = true;
	evidence?.logEvent("server:ready", { port, pid: child.pid });

	const stop = async (): Promise<void> => {
		if (!running) return;
		running = false;
		await stopChild(child, port);
		evidence?.logEvent("server:stop", { port, killSemantics: KILL_SEMANTICS });
	};

	const restart = async (): Promise<void> => {
		await stop();
		const next = await boot(port);
		child = next.child;
		running = true;
		evidence?.logEvent("server:restart", { port, pid: child.pid });
	};

	return {
		port,
		baseUrl: `http://localhost:${port}`,
		databaseUrl: options.databaseUrl,
		betterAuthSecret,
		pid: () => (running ? child.pid : undefined),
		logTail: (count) => sink.tail(count),
		logNote: (line) => sink.push("note", line),
		stop,
		restart,
	};
};

export type DrainQueueResult = { exitCode: number; output: string };

/**
 * Explicit queue-drain lever: nothing else ever consumes jobs (no worker
 * entrypoint exists; pg-boss never auto-consumes here), so published jobs sit
 * until drained. The entry file is the only one allowed to import the generated
 * app (harness-guards guard (c)) and runs in its own process with an allowlist
 * env — app module globals and dev credentials stay out of the harness test
 * process.
 */
export const drainQueue = async (databaseUrl: string): Promise<DrainQueueResult> => {
	const child = Bun.spawn(
		["bun", "--no-env-file", "tests/scenarios/harness/real/drain-queue.entry.ts"],
		{
			cwd: appRoot,
			env: {
				PATH: process.env.PATH ?? "",
				HOME: process.env.HOME ?? "",
				DATABASE_URL: databaseUrl,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, output: `${stdout}\n${stderr}`.trim() };
};
