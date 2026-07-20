import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * STORYBOOK qprobe config — select explicitly for design-kit sessions:
 *
 *   QPROBE_CONFIG=qprobe.storybook.config.ts qprobe <command>
 *
 * The repo-root default (qprobe.config.ts) is the PRODUCT harness surface; the
 * distinct tests.dir here (tests/qprobe vs tests/qprobe-product) is the real
 * isolation, because `qprobe replay` unconditionally rewrites
 * <tests.dir>/playwright.config.ts on every run.
 */
const repoRoot = dirname(fileURLToPath(import.meta.url));

export default {
	browser: {
		driver: "agent-browser",
		headless: true,
		baseUrl: "http://127.0.0.1:6007",
	},
	http: {
		baseUrl: "http://127.0.0.1:6007",
	},
	tests: {
		dir: join(repoRoot, "tests", "qprobe"),
		timeout: 30000,
	},
};
