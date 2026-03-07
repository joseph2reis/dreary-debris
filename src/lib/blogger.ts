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
const CACHE_TTL_SECONDS = Number(import.meta.env.POSTS_CACHE_TTL_SECONDS ?? "120");
const CACHE_TTL_MS = Math.max(15, CACHE_TTL_SECONDS) * 1000;

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

// Cache em memoria com TTL para evitar conteudo desatualizado em SSR.
let postsCache: Post[] | null = null;
let postsCacheExpiresAt = 0;

// Redis support (optional). Se REDIS_URL estiver configurada, usaremos Redis
// para cache persistente. Em Cloudflare runtime, ioredis nao e suportado.
let redisClient: any = null;
try {
  const REDIS_URL =
    import.meta.env.REDIS_URL ||
    (typeof process !== "undefined" ? process.env?.REDIS_URL : undefined);
  const isCloudflareRuntime = typeof WebSocketPair !== "undefined";

  if (REDIS_URL && !isCloudflareRuntime) {
    // @ts-ignore
    const Redis = await import("ioredis");
    // @ts-ignore
    redisClient = new Redis.default ? new Redis.default(REDIS_URL) : new Redis(REDIS_URL);
  }
} catch {
  redisClient = null;
}

export async function getPosts(): Promise<Post[]> {
  const cacheKey = "posts";

  // 1) tentar cache em memoria
  if (postsCache && Date.now() < postsCacheExpiresAt) {
    return postsCache;
  }

  // 2) tentar cache em Redis se disponivel
  if (redisClient) {
    try {
      const raw = await redisClient.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Post[];
        postsCache = parsed;
        postsCacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return parsed;
      }
    } catch {
      // ignore redis errors and fallback
    }
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

  postsCache = posts;
  postsCacheExpiresAt = Date.now() + CACHE_TTL_MS;

  // 3) salvar em Redis com TTL (quando disponivel)
  if (redisClient) {
    try {
      const ttl = Math.max(30, CACHE_TTL_SECONDS);
      await redisClient.set(cacheKey, JSON.stringify(posts), "EX", ttl);
      for (const p of posts) {
        await redisClient.set(`post:${p.id}`, JSON.stringify(p), "EX", ttl);
        if (p.slug) {
          await redisClient.set(`post:slug:${p.slug}`, JSON.stringify(p), "EX", ttl);
        }
      }
    } catch {
      // ignore
    }
  }

  return posts;
}

export async function getPost(id: string): Promise<Post | null> {
  // 1) checar cache em memoria primeiro
  if (postsCache && Date.now() < postsCacheExpiresAt) {
    const found = postsCache.find((p) => p.id === id || p.slug === id);
    if (found) return found;
  }

  // 2) checar Redis
  if (redisClient) {
    try {
      const byId = await redisClient.get(`post:${id}`);
      if (byId) return JSON.parse(byId) as Post;
      const bySlug = await redisClient.get(`post:slug:${id}`);
      if (bySlug) return JSON.parse(bySlug) as Post;
    } catch {
      // ignore
    }
  }

  // 3) tentar buscar post individual por id
  try {
    const res = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${id}?key=${API_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      const mapped = mapToPost(data);
      if (redisClient) {
        try {
          const ttl = Math.max(30, CACHE_TTL_SECONDS);
          await redisClient.set(`post:${mapped.id}`, JSON.stringify(mapped), "EX", ttl);
          if (mapped.slug) {
            await redisClient.set(`post:slug:${mapped.slug}`, JSON.stringify(mapped), "EX", ttl);
          }
        } catch {
          // ignore
        }
      }
      return mapped;
    }
  } catch {
    // ignore and fallback
  }

  // 4) fallback: buscar lista e localizar por id/slug
  const posts = await getPosts();
  const found = posts.find((p) => p.id === id || p.slug === id);
  return found || null;
}
