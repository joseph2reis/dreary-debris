import React, { useMemo, useState } from 'react';
import Fuse from 'fuse.js';

type Post = {
  title: string;
  description: string;
  slug: string;
  date?: string;
};

export default function Search({ posts }: { posts: Post[] }) {
  const [q, setQ] = useState('');

  const fuse = useMemo(() => {
    return new Fuse(posts || [], {
      keys: ['title', 'description'],
      threshold: 0.3,
    });
  }, [posts]);

  const results = q ? fuse.search(q).map((r) => r.item) : [];

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex gap-2 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar posts..."
          className="flex-auto rounded-full border border-border bg-background px-4 py-2 text-text focus:ring-2 focus:ring-primary outline-none"
          aria-label="Buscar posts"
        />
      </div>

      {results.length > 0 && (
        <ul className="space-y-4">
          {results.map((post) => (
            <li key={post.slug}>
              <a href={`/blog/${post.slug}`} className="block">
                <div className="text-sm text-text-muted">{post.date}</div>
                <div className="text-lg font-bold text-text">{post.title}</div>
                <div className="text-sm text-text-muted">{post.description}</div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
