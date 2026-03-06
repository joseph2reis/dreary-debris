export interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  date: string; // already formatted pt-BR
  publishedAt: string; // ISO date
  readingTime: string;
  labels?: string[];
  content: string;
  author: {
    displayName: string;
    image?: any;
  };
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCharCode(value) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const value = Number.parseInt(hex, 16);
      return Number.isFinite(value) ? String.fromCharCode(value) : "";
    });
}

function htmlToPlainText(html: string) {
  const withBreaks = html
    .replace(/<\s*br[^>]*>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, " ");

  const withoutTags = withBreaks.replace(/<\/?[^>]+(>|$)/g, " ");

  return decodeHtmlEntities(withoutTags)
    .replace(/\s+/g, " ")
    .trim();
}

function buildExcerpt(html: string, maxLength = 160) {
  const text = htmlToPlainText(html);
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 120 ? sliced.slice(0, lastSpace) : sliced;
  return `${base}...`;
}

function estimateReadingTime(html: string) {
  const text = htmlToPlainText(html);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min de leitura`;
}

function extractImage(content: string): string | undefined {
  const match = content.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : undefined;
}

function extractSlug(url: string) {
  return url.split("/").pop()?.replace(".html", "");
}

const BLOG_ID = import.meta.env.BLOG_ID;
const API_KEY = import.meta.env.BLOGGER_KEY;

function mapToPost(post: any): Post {
  const publishedAt = post.published || post.updated || new Date().toISOString();
  const parsed = new Date(publishedAt);
  const date = isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  const rawContent = post.content || "";

  return {
    id: post.id,
    slug: extractSlug(post.url) || post.id,
    title: post.title,
    description: buildExcerpt(rawContent, 170),
    image: extractImage(rawContent),
    date,
    readingTime: estimateReadingTime(rawContent),
    labels: post.labels || [],
    publishedAt,
    content: rawContent,
    author: {
      displayName: post.author?.displayName || "",
      image: post.author?.image,
    },
  } as Post;
}

// Cache simples em memória por instância do worker
const POSTS_CACHE_TTL_MS = 60 * 1000;
const postsCache = new Map<string, { value: Post[]; expiresAt: number }>();

export async function getPosts(): Promise<Post[]> {
  const cacheKey = "posts";
  const cached = postsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const res = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?key=${API_KEY}`
  );

  if (!res.ok) return [];

  let data: { items?: any[] };
  try {
    data = await res.json();
  } catch {
    return [];
  }

  if (!data.items) return [];

  const posts: Post[] = data.items.map((post: any) => mapToPost(post));
  postsCache.set(cacheKey, {
    value: posts,
    expiresAt: Date.now() + POSTS_CACHE_TTL_MS,
  });
  return posts;
}

export async function getPost(idOrSlug: string): Promise<Post | null> {
  for (const entry of postsCache.values()) {
    if (entry.expiresAt <= Date.now()) continue;
    const found = entry.value.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    if (found) return found;
  }

  const posts = await getPosts();
  const found = posts.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
  if (found) return found;

  // fallback: tenta buscar como ID direto no Blogger
  try {
    const res = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${idOrSlug}?key=${API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return mapToPost(data);
  } catch {
    return null;
  }
}
