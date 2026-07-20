import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignInScreen } from "@/components/screens/sign-in-screen";

type SignInSearch = {
	redirect?: string;
	continue?: "invitation";
};

/** Only same-app absolute paths survive; "//host" and external URLs are dropped. */
const sanitizeInternalPath = (value: unknown): string | undefined =>
	typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;

export const Route = createFileRoute("/sign-in")({
	validateSearch: (search: Record<string, unknown>): SignInSearch => ({
		redirect: sanitizeInternalPath(search.redirect),
		continue: search.continue === "invitation" ? "invitation" : undefined,
	}),
	loaderDeps: ({ search }) => ({ continuation: search.continue === "invitation" }),
	beforeLoad: async ({ context, search }) => {
		const session = await context.queryClient.ensureQueryData(context.session());
		// US-AUTH-01: signed-in visitors never see the form.
		if (session) throw redirect({ href: search.redirect ?? "/" });
	},
	loader: async ({ context, deps }) => {
		// Only an invitation continuation reads the masked challenge context.
		if (!deps.continuation) return { continuation: null };
		const continuation = await context.queryClient.ensureQueryData(context.invitationChallenge());
		return { continuation };
	},
	head: () => ({
		meta: [{ title: "Prihlásenie — QUESTPIE Autopilot" }],
	}),
	component: SignInRoute,
});

function SignInRoute() {
	const search = Route.useSearch();
	const { continuation } = Route.useLoaderData();
	return <SignInScreen redirectTo={search.redirect ?? "/"} continuation={continuation} />;
}
