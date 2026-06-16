/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { handleApi } from '../src/api';

/**
 * Vite config for the Wet Lab Interim Report Builder app.
 * Run with: npm run dev:interim
 * All interim-specific source files live in this folder (interim_app/).
 */
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    {
      name: 'api-server',
      configureServer(server) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url?.startsWith('/api/')) {
            handleApi(req, res, next);
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 5174,   // separate port so both apps can run simultaneously
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
