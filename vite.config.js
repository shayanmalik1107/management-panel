import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/otp': {
        target: 'http://localhost:5199',
        changeOrigin: true,
      }
    }
  }
})
