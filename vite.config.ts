import { defineConfig } from 'vite';
import { devSaveTuningPlugin } from './tools/devSavePlugin.ts';

export default defineConfig({
  // Relative paths so the built game works from any folder or host (Cloudflare Pages, Electron...).
  base: './',
  plugins: [devSaveTuningPlugin()],
  server: {
    port: 5173,
  },
});
