import { useMemo, useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import { Search } from "lucide-react";

type Post = {
  title: string;
  description: string;
  slug: string;
  date?: string;
};

export default function SearchCompact({ posts }: { posts: Post[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const fuse = useMemo(() => {
    return new Fuse(posts || [], {
      keys: ["title", "description"],
      threshold: 0.3,
    });
  }, [posts]);

  const results = q ? fuse.search(q).map((r) => r.item) : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar..."
          className="w-full rounded-full border border-border bg-background pl-9 pr-3 py-2 text-sm text-text focus:ring-2 focus:ring-primary outline-none"
          aria-label="Buscar posts"
        />
      </div>

      {open && q && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl bg-surface-solid border border-border shadow-lg">
          <ul className="max-h-64 overflow-auto p-2">
            {results.map((post) => (
              <li
                key={post.slug}
                className="py-2 px-2 hover:bg-background rounded"
              >
                <a href={`/blog/${post.slug}`} className="block">
                  <div className="text-sm text-text-muted">{post.date}</div>
                  <div className="text-sm font-semibold text-text">
                    {post.title}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && q && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl bg-surface border border-border shadow-lg p-3 text-text-muted">
          Nenhum resultado
        </div>
      )}
    </div>
  );
}
