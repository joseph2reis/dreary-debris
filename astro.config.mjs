// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  prefetch: true,
  site: process.env.SITE_URL || 'https://example.com',
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare({
    imageService: "compile",
  }),
  integrations: [react(), sitemap()],
});
