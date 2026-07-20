import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	basePath: "/api/auth",
});

export type AppAuthClient = typeof authClient;
