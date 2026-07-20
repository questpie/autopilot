import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react(), tailwindcss()],
	optimizeDeps: { include: ["streamdown"] },
	resolve: {
		alias: {
			"@questpie/ui": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
			{
				extends: true,
				plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						provider: "playwright",
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
