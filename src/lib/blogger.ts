export interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  date: string; // already formatted pt-BR
  publishedAt: string; // ISO date
  labels?: string[];
  content: string;
  author: {
    displayName: string;
    image?: any;
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>?/gm, "");
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

  const data = await res.json();
  if (!data.items) return [];

  const posts: Post[] = data.items.map((post: any) => {
    const publishedAt = post.published || post.updated || new Date().toISOString();
    const parsed = new Date(publishedAt);
    const date = isNaN(parsed.getTime())
      ? ""
      : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    return {
      id: post.id,
      slug: extractSlug(post.url) || post.id,
      title: post.title,
      description: stripHtml(post.content).slice(0, 160) + "...",
      image: extractImage(post.content),
      date,
      labels: post.labels || [],
      publishedAt,
      content: post.content,
      author: {
        displayName: post.author.displayName,
        image: post.author.image,
      },
    } as Post;
  });

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

  // 3) fallback para buscar todos e procurar
  const posts = await getPosts();
  const found = posts.find((p) => p.id === id || p.slug === id);
  return found || null;
}



