// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  prefetch: true,
  site: process.env.SITE_URL || 'https://example.com',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), sitemap()],
});
