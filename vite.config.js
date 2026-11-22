import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let otpProcess = null;

function otpServerPlugin() {
  return {
    name: 'otp-server-launcher',
    configureServer(server) {
      if (!otpProcess) {
        otpProcess = spawn('node', ['server/otpServer.js'], {
          cwd: __dirname,
          stdio: 'inherit',
          env: process.env,
        });
        otpProcess.on('error', (err) => {
          console.warn('[Vite OTP Plugin] OTP server notice:', err.message);
        });
      }
      server.httpServer?.on('close', () => {
        if (otpProcess) {
          try { otpProcess.kill(); } catch (_) {}
          otpProcess = null;
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), otpServerPlugin()],
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
