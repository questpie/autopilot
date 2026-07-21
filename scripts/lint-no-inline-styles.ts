const roots = ["apps/operator-web/src", "packages/ui/src"];
const forbidden = [
	{ pattern: /\bstyle\s*=\s*\{\{/u, reason: "inline React style" },
	{ pattern: /\bstyle\s*=\s*["']/u, reason: "inline HTML style" },
];
// Email templates are exempt: this rule guards the Tailwind/token-driven UI,
// but email HTML is a different medium — mail clients strip `<style>` blocks
// and never load external CSS, so inline styles are the required, standard way
// to style an email. Scoped to the QUESTPIE server email-template dir
// (`questpie/server/emails/`) so a future `emails/` UI directory stays covered.
const exempt = /(?:^|\/)server\/emails\//u;
const violations: string[] = [];

for (const root of roots) {
	const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,html}");
	for await (const relativePath of glob.scan({ cwd: root })) {
		if (exempt.test(relativePath)) continue;
		const path = `${root}/${relativePath}`;
		const source = await Bun.file(path).text();
		for (const { pattern, reason } of forbidden) {
			if (pattern.test(source)) violations.push(`${path}: ${reason}`);
		}
	}
}

if (violations.length > 0) {
	console.error(violations.join("\n"));
	process.exit(1);
}

console.info("Bez inline štýlov.");
