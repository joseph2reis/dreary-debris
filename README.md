# Cafe Com Fe

Frontend do projeto **Cafe Com Fe**, um blog em Astro com foco em programacao, fe e proposito.

O site consome posts do Blogger, possui busca local, pagina de contato, area administrativa para moderacao de comentarios e paginas institucionais como termos de uso e politica de privacidade.

## Stack

- Astro 5
- Tailwind CSS 4
- React 19 (componentes pontuais no cliente)
- Fuse.js (busca)
- ioredis (cache opcional)

## Principais Recursos

- Home com destaque, ultimos posts, noticias e categorias
- Listagem de posts e pagina individual de artigo
- Paginas por tag
- Busca de posts no header e na pagina do blog
- Comentarios com moderacao
- Painel `/admin` para aprovar ou rejeitar comentarios
- Paginas `/sobre`, `/contato`, `/termos` e `/privacidade`
- RSS, sitemap e robots.txt
- Tema claro/escuro

## Estrutura

```text
/
|-- public/
|-- src/
|   |-- components/
|   |-- layouts/
|   |-- lib/
|   |-- pages/
|   `-- styles/
|-- astro.config.mjs
|-- package.json
`-- tailwind.config.ts
```

## Variaveis de Ambiente

Crie um arquivo `.env` na raiz do frontend com as variaveis abaixo:

```env
BLOG_ID=seu_blog_id
BLOGGER_KEY=sua_chave_do_blogger
REDIS_URL=
SITE_URL=https://seu-dominio.com
POSTS_CACHE_TTL_SECONDS=120
```

### Uso das variaveis

- `BLOG_ID`: ID do blog no Blogger
- `BLOGGER_KEY`: chave da API do Blogger
- `REDIS_URL`: cache opcional para posts
- `SITE_URL`: URL publica usada em canonical, RSS e sitemap
- `robots.txt`: liberado para indexacao publica e bloqueando apenas `/admin`
- `POSTS_CACHE_TTL_SECONDS`: tempo de cache em segundos para posts no SSR (padrao: 120)

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
npm run cf:dev
```

`npm run preview` e `npm run cf:dev` usam `wrangler dev ./dist/_worker.js/index.js --assets ./dist --compatibility-flags nodejs_compat`, que e o fluxo correto para testar o projeto com `@astrojs/cloudflare` em SSR.

## Rotas Principais

- `/`
- `/blog`
- `/blog/[slug]`
- `/blog/tag/[tag]`
- `/sobre`
- `/contato`
- `/termos`
- `/privacidade`
- `/admin`
- `/rss.xml`

## Observacoes

- O formulario de contato atual abre o cliente de e-mail do usuario via `mailto`.
- O botao de tema usa `localStorage` para persistir a preferencia.
- O painel admin depende da API de comentarios configurada no frontend.
- Em `output: "server"` (Cloudflare Pages SSR), posts do Blogger atualizam automaticamente sem build hook.
