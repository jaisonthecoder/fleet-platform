import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import english from './src/i18n/en-US.json';
import spanish from './src/i18n/es-ES.json';

export default defineConfig(({ mode }) => {
  const environmentFiles: Record<string, string> = {
    development: '.env.local',
    uat: '.env.uat',
    prod: '.env.prod',
    production: '.env.prod',
  };
  const environmentFile = environmentFiles[mode];
  const environmentPath = environmentFile ? new URL(environmentFile, import.meta.url) : undefined;
  const fileEnvironment =
    environmentPath && existsSync(environmentPath)
      ? parseEnv(readFileSync(environmentPath, 'utf8'))
      : {};
  const environment = { ...fileEnvironment, ...process.env };

  return {
    envDir: false,
    define: Object.fromEntries(
      Object.entries(environment)
        .filter(([key, value]) => key.startsWith('VITE_') && value !== undefined)
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'noatum-locale-parity',
        buildStart() {
          const englishKeys = Object.keys(english).sort();
          const spanishKeys = Object.keys(spanish).sort();
          if (
            JSON.stringify(englishKeys) !== JSON.stringify(spanishKeys) ||
            Object.values(spanish).some((value) => !value.trim())
          ) {
            throw new Error('Every English translation requires a nonempty Spanish translation.');
          }
        },
      },
    ],
    resolve: {
      alias: {
        // Must mirror the paths in tsconfig.json, or the editor and the bundler disagree
        // about where a module lives — which fails only at build time.
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: { port: 45173, strictPort: true },
    build: { outDir: 'dist', sourcemap: true },
  };
});
