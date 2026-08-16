import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    // Явный IPv4 loopback: на части Windows-машин localhost разрешается в
    // недоступный ::1, из-за чего браузер получает ERR_CONNECTION_REFUSED.
    host: '127.0.0.1',
    port: 5173,
    // Проксируем API, чтобы в разработке не упираться в CORS
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    proxy: apiProxy,
  },
});
