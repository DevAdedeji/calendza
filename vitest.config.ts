import { defineConfig } from 'vitest/config'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

if (existsSync('.env.test')) {
  process.loadEnvFile('.env.test')
}

export default defineConfig({
  // Nuxt supplies #shared at build time. Tests import the server directly, so
  // anything pulling a value (not just a type) out of shared/ needs it here.
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
      '@@': fileURLToPath(new URL('.', import.meta.url)),
      'vue': createRequire(import.meta.resolve('nuxt/package.json')).resolve('vue')
    }
  },

  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'test/unit/**/*.test.ts'],

    fileParallelism: false,

    coverage: {
      provider: 'v8',
      include: ['server/domain/**/*.ts'],
      exclude: ['server/domain/types.ts'],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95
      }
    }
  }
})
