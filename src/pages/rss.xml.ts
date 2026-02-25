import type { APIRoute } from "astro";
import { getPosts } from "../lib/blogger";

const siteUrl = process.env.SITE_URL || "https://example.com";

export const GET: APIRoute = async () => {
  const posts = await getPosts();

  const items = posts
    .map(
      (post) => `
  <item>
    <title>${escapeHtml(post.title)}</title>
    <link>${siteUrl}/blog/${post.slug}</link>
    <guid isPermaLink="true">${siteUrl}/blog/${post.slug}</guid>
    <pubDate>${new Date(post.publishedAt || post.date || Date.now()).toUTCString()}</pubDate>
    <description>${escapeHtml(post.description)}</description>
  </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
  <channel>
    <title>Caf\u00e9 Com F\u00e9</title>
    <link>${siteUrl}</link>
    <description>Programacao, fe e proposito</description>
    ${items}
  </channel>
  </rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
