/// <reference types="vitest/config" />
import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

installGlobals()

const base = process.env.GITHUB_PAGES === 'true' ? '/color-recognizer/' : '/'

export default defineConfig({
  base,
  plugins: [
    ...(process.env.VITEST
      ? []
      : [
          remix({
            basename: base,
            ssr: false,
            future: {
              v3_lazyRouteDiscovery: true,
              v3_fetcherPersist: true,
              v3_relativeSplatPath: true,
              v3_throwAbortReason: true,
            },
          }),
        ]),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
})
