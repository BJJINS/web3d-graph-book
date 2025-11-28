import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('three-')
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/docs'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild'
  }
})