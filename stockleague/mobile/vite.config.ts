import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' : l'appli est servie depuis les fichiers embarqués de l'APK.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
} as never);
