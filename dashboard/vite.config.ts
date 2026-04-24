// Vite is used here (not Bun.serve) to get the proxy feature needed to
// forward /balance requests to the Hono backend at localhost:3000.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/balance': 'http://localhost:3000',
    },
  },
})
