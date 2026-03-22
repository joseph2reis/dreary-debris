import type { APIRoute } from "astro";

export const GET: APIRoute = ({ url }) => {
  const origin = url.origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    `Sitemap: ${origin}/sitemap-index.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
