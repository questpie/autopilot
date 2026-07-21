import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, searchForWorkspaceRoot, type PluginOption } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `questpie` is consumed as linked source: `node_modules/questpie` is a
 * symlink into the sibling `questpie-cms` checkout, and its package.json
 * `exports["."]` points at `src/`. That means dev requests need to read
 * files (and their transitive deps, e.g. better-auth/defu) from a directory
 * tree outside this repo. Vite's `server.fs.allow` defaults to this repo's
 * own workspace root only, so those reads were silently dropped — surfacing
 * as a misleading "Failed to load url ... Does the file exist?" for files
 * that do exist. Setting `fs.allow` replaces Vite's default rather than
 * extending it, so this repo's own root has to be listed alongside
 * questpie-cms's.
 */
const questpieWorkspaceRoot = searchForWorkspaceRoot(
	realpathSync(path.resolve(dirname, "node_modules/questpie")),
);
const appWorkspaceRoot = searchForWorkspaceRoot(dirname);

export default defineConfig({
	plugins: [
		devtools(),
		nitro({ preset: "bun" }) as unknown as PluginOption,
		viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
	server: {
		fs: {
			allow: [appWorkspaceRoot, questpieWorkspaceRoot],
		},
	},
	optimizeDeps: {
		exclude: ["drizzle-kit"],
	},
	build: {
		rollupOptions: {
			external: ["bun", /^drizzle-kit/, /^@aws-sdk\//],
		},
	},
});
