import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core (shared across all routes)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Vendor: DnD kit (only used by AccessLens)
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // Vendor: Dexie IndexedDB (API cache layer)
          'vendor-dexie': ['dexie'],
          // Vendor: TanStack React Query
          'vendor-query': ['@tanstack/react-query'],
        }
      }
    }
  },
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
      },
      // Proxy Anthropic Claude API to avoid CORS issues in development
      '/anthropic-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/anthropic-api/, ''),
      }
    }
  }
})
