import type { FixtureIdFactory } from "./ids";

const sessionCookieName = "autopilot_fixture_session";

export interface AuthFixture {
	readonly baseUrl: string;
	readonly sessionCookieName: string;
	readonly requests: readonly { method: string; pathname: string }[];
	stop(): void;
}

export function startAuthFixture(ids: FixtureIdFactory): AuthFixture {
	const validSessions = new Set<string>();
	const requests: { method: string; pathname: string }[] = [];
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			const url = new URL(request.url);
			requests.push({ method: request.method, pathname: url.pathname });

			if (request.method === "POST" && url.pathname === "/auth/sign-in") {
				const input = (await request.json()) as { email?: string };
				if (!input.email) return Response.json({ code: "email_required" }, { status: 400 });

				const sessionId = ids.next("session");
				validSessions.add(sessionId);
				return new Response(null, {
					status: 303,
					headers: {
						location: "/app",
						"set-cookie": `${sessionCookieName}=${sessionId}; HttpOnly; Path=/; SameSite=Lax`,
					},
				});
			}

			if (request.method === "GET" && url.pathname === "/app") {
				const cookie = request.headers.get("cookie") ?? "";
				const sessionId = cookie
					.split(";")
					.map((part) => part.trim())
					.find((part) => part.startsWith(`${sessionCookieName}=`))
					?.slice(sessionCookieName.length + 1);

				if (!sessionId || !validSessions.has(sessionId)) {
					return new Response(null, { status: 303, headers: { location: "/sign-in" } });
				}

				return Response.json({ authenticated: true });
			}

			return new Response("Not found", { status: 404 });
		},
	});

	return {
		baseUrl: server.url.origin,
		sessionCookieName,
		requests,
		stop() {
			server.stop(true);
			validSessions.clear();
		},
	};
}
