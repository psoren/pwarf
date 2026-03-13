import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const redirectRoot: Plugin = {
  name: 'redirect-root',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/') {
        res.writeHead(302, { Location: '/pwarf/' })
        res.end()
        return
      }
      next()
    })
  },
}

export default defineConfig({
  base: '/pwarf/',
  plugins: [react(), tsconfigPaths(), redirectRoot],
  build: {
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['tests/ui/**', 'jsdom'],
      ['src/ui/**', 'jsdom'],
    ],
  },
})
