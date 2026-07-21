import { getContext } from "questpie";
import { authConfig } from "questpie/app";

import type { App } from "@/questpie/server/.generated";

/**
 * Auth configuration (Better Auth options).
 *
 * `requireEmailVerification` stays on: sign-in is blocked until the address is
 * verified. The `emailVerification` hook only adds DELIVERY — it does not relax
 * that gate. Better Auth invokes `sendVerificationEmail` synchronously while
 * handling the sign-up request, which the framework runs inside its
 * `runWithContext` ALS scope, so `getContext()` resolves the app here; we read
 * it before the first `await` and hand it to the mailer explicitly, so the send
 * never depends on the ALS frame still being live.
 *
 * In development the console mail adapter (see `questpie.config.ts`) logs the
 * message, so the verify link appears in the dev-server output.
 */
export default authConfig({
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) => {
			const { app } = getContext<App>();
			await app.email.sendTemplate({
				template: "verifyEmail",
				to: user.email,
				input: { verifyUrl: url, name: user.name },
				locale: "sk",
				ctx: { app },
			});
		},
	},
});
