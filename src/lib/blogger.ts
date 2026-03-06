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

// Cache simples para posts (durante a execução do build)
const postsCache = new Map<string, Post[]>();

// Redis support (optional). Se `REDIS_URL` estiver configurada, usaremos Redis
// para cache persistente. Caso contrário, usamos o cache em memória acima.
let redisClient: any = null;
try {
  const REDIS_URL = process.env.REDIS_URL;
  if (REDIS_URL) {
    // Import dinamicamente para não quebrar ambiente sem dependência
    // (ioredis foi instalado como dependência do projeto)
    // @ts-ignore
    const Redis = await import('ioredis');
    // ioredis default export é a classe
    // @ts-ignore
    redisClient = new Redis.default ? new Redis.default(REDIS_URL) : new Redis(REDIS_URL);
  }
} catch (err) {
  // Falha ao conectar ao Redis — continuar sem Redis
  redisClient = null;
}

export async function getPosts(): Promise<Post[]> {
  const cacheKey = 'posts';
  // 1) tentar cache em memória
  if (postsCache.has(cacheKey)) {
    return postsCache.get(cacheKey)!;
  }

  // 2) tentar cache em Redis se disponível
  if (redisClient) {
    try {
      const raw = await redisClient.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Post[];
        // popular cache em memória também
        postsCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {
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

  postsCache.set(cacheKey, posts);

  // também salva no Redis com TTL (ex: 3600s = 1h)
  if (redisClient) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(posts), 'EX', 3600);
      // opcional: salvar posts individuais
      for (const p of posts) {
        await redisClient.set(`post:${p.id}`, JSON.stringify(p), 'EX', 3600);
        if (p.slug) {
          await redisClient.set(`post:slug:${p.slug}`, JSON.stringify(p), 'EX', 3600);
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return posts;
}

export async function getPost(id: string): Promise<Post | null> {
  // tenta achar no cache
  // 1) checar cache em memória primeiro
  for (const val of postsCache.values()) {
    const found = val.find((p) => p.id === id || p.slug === id);
    if (found) return found;
  }

  // 2) checar Redis
  if (redisClient) {
    try {
      const byId = await redisClient.get(`post:${id}`);
      if (byId) return JSON.parse(byId) as Post;
      const bySlug = await redisClient.get(`post:slug:${id}`);
      if (bySlug) return JSON.parse(bySlug) as Post;
    } catch (e) {
      // ignore
    }
  }

  // 3) buscar post individual para garantir conteúdo completo
  try {
    const res = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${id}?key=${API_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      const mapped = mapToPost(data);
      if (redisClient) {
        try {
          await redisClient.set(`post:${mapped.id}`, JSON.stringify(mapped), "EX", 3600);
          if (mapped.slug) {
            await redisClient.set(`post:slug:${mapped.slug}`, JSON.stringify(mapped), "EX", 3600);
          }
        } catch (e) {
          // ignore
        }
      }
      return mapped;
    }
  } catch (e) {
    // ignore and fallback
  }

  // 4) fallback para buscar todos e procurar
  const posts = await getPosts();
  const found = posts.find((p) => p.id === id || p.slug === id);
  return found || null;
}



