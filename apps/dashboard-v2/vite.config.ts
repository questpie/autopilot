import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  plugins: [
    devtools(),
    nitro() as any,
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:7778",
      "/webhooks": "http://localhost:7778",
      "/streams": "http://localhost:7778",
      "/artifacts": "http://localhost:7778",
      "/fs": "http://localhost:7778",
    },
  },
})

export default config
