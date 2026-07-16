import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        inline: [/@primer\/react/],
      },
    },
  },
  resolve: {
    alias: {
      '@tauri-apps/api/core': resolve(__dirname, 'src/__mocks__/tauri.ts'),
      '@tauri-apps/api/event': resolve(__dirname, 'src/__mocks__/tauri.ts'),
    },
  },
});
