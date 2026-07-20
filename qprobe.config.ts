import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PRODUCT qprobe config — the default config c12 discovers at the repo root.
 *
 * Product replays (tests/qprobe-product) run against a scenario-harness server on a
 * per-run random port, so this config deliberately sets NO baseUrl: always pass
 * `--base http://localhost:<port>` (see tests/qprobe-product/README.md).
 *
 * `tests.dir` is absolute so `qprobe replay` resolves spec paths and rewrites
 * tests/qprobe-product/playwright.config.ts (gitignored) correctly from any cwd.
 * Playwright itself only discovers that generated config when its cwd IS the tests
 * dir, so replays run with cwd tests/qprobe-product plus QPROBE_CONFIG pointing here.
 *
 * Storybook visual-kit qprobe work selects qprobe.storybook.config.ts via
 * QPROBE_CONFIG instead — the two configs isolate by distinct tests.dir values.
 */
const repoRoot = dirname(fileURLToPath(import.meta.url));

export default {
	browser: {
		driver: "agent-browser",
		headless: true,
	},
	tests: {
		dir: join(repoRoot, "tests", "qprobe-product"),
		timeout: 30000,
	},
};
