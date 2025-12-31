import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://api-production-46e2.up.railway.app',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
