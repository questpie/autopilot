import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
	plugins: [react(), tailwindcss()],
	optimizeDeps: { include: ["streamdown"] },
	resolve: {
		alias: {
			"@questpie/ui": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	build: {
		lib: {
			entry: "src/index.ts",
			formats: ["es"],
		},
		rollupOptions: {
			external: ["react", "react-dom", "react/jsx-runtime"],
		},
	},
});
