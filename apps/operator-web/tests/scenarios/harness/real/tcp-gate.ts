import type { Socket } from "bun";

/**
 * Test-owned TCP relay: byte-blind fault injection for the framework's SSE
 * channel transport. Accepts on an ephemeral port and pipes bytes both ways to
 * 127.0.0.1:<targetPort> — zero protocol logic. close() kills live sockets and
 * refuses new connections; open() resumes. It exists because it makes
 * disconnect / publish-while-down / prune / reconnect fully deterministic where
 * bare server-restart racing the transport's jittered auto-reconnect is not
 * (server-process restart() stays available as the harsher cross-process lever).
 */

type GateConnection = {
	upstream: Socket<undefined> | null;
	/** Bytes from the client buffered until the upstream connect resolves. */
	pending: Uint8Array[];
	closed: boolean;
};

export type TcpGate = {
	port: number;
	/** 127.0.0.1 literal — no localhost family ambiguity on the fault path. */
	baseUrl: string;
	/** Kill live sockets and refuse new connections until open(). */
	close: () => void;
	/** Resume accepting and relaying. */
	open: () => void;
	/** Final teardown: close everything and unbind the listener. */
	stop: () => void;
};

export const startTcpGate = (targetPort: number): TcpGate => {
	let accepting = true;
	const downstreams = new Set<Socket<GateConnection>>();

	const listener = Bun.listen<GateConnection>({
		hostname: "127.0.0.1",
		port: 0,
		socket: {
			open(down) {
				if (!accepting) {
					down.terminate();
					return;
				}
				const state: GateConnection = { upstream: null, pending: [], closed: false };
				down.data = state;
				downstreams.add(down);
				Bun.connect<undefined>({
					hostname: "127.0.0.1",
					port: targetPort,
					socket: {
						open(up) {
							if (state.closed) {
								up.terminate();
								return;
							}
							state.upstream = up;
							for (const chunk of state.pending) up.write(chunk);
							state.pending = [];
						},
						data(_up, chunk) {
							if (!state.closed) down.write(chunk);
						},
						close() {
							state.upstream = null;
							if (!state.closed) down.end();
						},
						error() {
							state.upstream = null;
							if (!state.closed) down.terminate();
						},
					},
				}).catch(() => {
					if (!state.closed) down.terminate();
				});
			},
			data(down, chunk) {
				const state = down.data as GateConnection | undefined;
				if (!state || state.closed) return;
				if (state.upstream) state.upstream.write(chunk);
				else state.pending.push(chunk);
			},
			close(down) {
				const state = down.data as GateConnection | undefined;
				downstreams.delete(down);
				if (!state || state.closed) return;
				state.closed = true;
				state.upstream?.end();
			},
			error(down) {
				const state = down.data as GateConnection | undefined;
				downstreams.delete(down);
				if (!state || state.closed) return;
				state.closed = true;
				state.upstream?.terminate();
			},
		},
	});

	const killLive = (): void => {
		// terminate() fires close(down) synchronously, which deletes only the
		// CURRENT element — safe during live Set iteration.
		for (const down of downstreams) {
			const state = down.data as GateConnection | undefined;
			if (state && !state.closed) {
				state.closed = true;
				state.upstream?.terminate();
			}
			down.terminate();
		}
		downstreams.clear();
	};

	const port = listener.port;
	return {
		port,
		baseUrl: `http://127.0.0.1:${port}`,
		close: () => {
			accepting = false;
			killLive();
		},
		open: () => {
			accepting = true;
		},
		stop: () => {
			accepting = false;
			killLive();
			listener.stop(true);
		},
	};
};
