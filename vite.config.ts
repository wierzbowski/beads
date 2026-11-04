import { defineConfig } from 'vitest/config';
import { galleryDevPlugin } from './src/galleryDevPlugin.ts';

export default defineConfig({
  base: '/beads/',
  plugins: [galleryDevPlugin()],
  test: {
    environment: 'node',
  },
});
