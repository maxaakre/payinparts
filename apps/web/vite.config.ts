import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// For local dev, proxy /api to the deployed site: VITE_API_PROXY=https://xxxx.cloudfront.net
const apiProxy = process.env.VITE_API_PROXY;

export default defineConfig({
  plugins: [react()],
  server: apiProxy ? { proxy: { '/api': { target: apiProxy, changeOrigin: true } } } : {},
  test: { environment: 'jsdom', globals: true },
});
