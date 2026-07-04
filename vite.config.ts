import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Dynamically load firebase-applet-config.json if it exists (only inside AI Studio dev container)
  let appletConfig: any = {};
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      appletConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.log("No firebase-applet-config.json loaded at build time.");
  }

  // Compute correct subpath base URL if deploying to GitHub Pages
  const base = process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
    : "/";

  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      __FIREBASE_APPLET_CONFIG__: JSON.stringify(appletConfig),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
