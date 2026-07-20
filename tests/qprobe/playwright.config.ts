import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./recordings",
	timeout: 30000,
	use: {
		baseURL: "http://127.0.0.1:6007",
		trace: "on-first-retry",
	},
	projects: [
		{ name: "chromium", use: { browserName: "chromium" } },
		{ name: "firefox", use: { browserName: "firefox" } },
		{ name: "webkit", use: { browserName: "webkit" } },
	],
});
