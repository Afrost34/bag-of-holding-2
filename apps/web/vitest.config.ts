import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __APP_BUILD__: JSON.stringify('test'),
  },
  test: {
    name: 'web',
    root: import.meta.dirname,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
