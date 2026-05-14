import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";

export default function Search() {
  const [query, setQuery] = useState("");

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-6 text-2xl font-bold">Search</h1>
      <div className="relative max-w-md">
        <SearchIcon
          size={16}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-subtle)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracks, albums, artists…"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-2 pr-4 pl-9 text-sm outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-text-muted)]"
        />
      </div>
      {query && (
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Searching for &ldquo;{query}&rdquo;… (Phase 1)
        </p>
      )}
    </div>
  );
}
