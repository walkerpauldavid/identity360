import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/OData': {
        target: 'https://pawa-poc2.omada.cloud',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://pawa-poc2.omada.cloud',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
