import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), '../..'), '');

  let consoleHost = 'localhost';
  if (env.CONSOLE_URL) {
    try {
      const u = new URL(env.CONSOLE_URL);
      consoleHost = u.hostname;
    } catch {}
  }

  return {
    plugins: [react()],
    define: {
      __CONSOLE_HOST__: JSON.stringify(consoleHost),
    },
    server: {
      port: 9999,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:4000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
