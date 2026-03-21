import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  base: '/autopilot/',
  plugins: [
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: process.env.DISABLE_PRERENDER !== 'true',
        routes: ['/'],
        crawlLinks: false,
      },
    }),
    react(),
    nitro({
      preset: 'bun',
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
});
