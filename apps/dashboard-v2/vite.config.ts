import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Split heavy dependencies into separate chunks
              "vendor-react": ["react", "react-dom"],
              "vendor-tanstack": [
                "@tanstack/react-query",
                "@tanstack/react-router",
              ],
              "vendor-motion": ["framer-motion"],
              "vendor-markdown": ["react-markdown"],
              "vendor-charts": ["recharts"],
              "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable"],
            },
          },
        },
      },
    },
  },
})

export default config
