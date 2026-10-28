import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/beads/',
  test: {
    environment: 'node',
  },
});
