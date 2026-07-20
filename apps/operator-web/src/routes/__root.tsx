import { createRootRouteWithContext, HeadContent, Link, Scripts } from "@tanstack/react-router";
import { Toaster } from "@questpie/ui";

import type { AppDataContext } from "@/lib/data/app-data-context";
import { ThemeProvider, useTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<AppDataContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				name: "theme-color",
				content: "#fafafa",
				media: "(prefers-color-scheme: light)",
			},
			{
				name: "theme-color",
				content: "#121212",
				media: "(prefers-color-scheme: dark)",
			},
			{ title: "operator-web" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	notFoundComponent: () => (
		<main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
			<h1 className="text-3xl font-bold tracking-tight">Stránka sa nenašla</h1>
			<p className="text-muted-foreground mt-3">Požadovaná stránka neexistuje.</p>
			<Link to="/" className="text-primary mt-6 inline-block text-sm font-medium hover:underline">
				Späť na úvod
			</Link>
		</main>
	),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="sk" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="bg-background text-foreground min-h-svh antialiased">
				<ThemeProvider defaultTheme="system">
					{children}
					<ThemeToaster />
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}

function ThemeToaster() {
	const { resolvedTheme } = useTheme();
	return <Toaster theme={resolvedTheme ?? "system"} />;
}
