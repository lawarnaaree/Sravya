import { useState, useEffect } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import TrackList from "@/components/TrackList";

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query.trim(), 400);

  const resultsQuery = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.library.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 10_000,
  });

  const results = resultsQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="shrink-0 px-6 pt-8 pb-5">
        <h1 className="mb-4 text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Search
        </h1>
        <div className="relative max-w-lg">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            style={{ color: "var(--text-subtle)" }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tracks, albums, artists…"
            autoFocus
            className="w-full rounded-full py-3 pr-5 pl-11 text-sm font-medium transition-all outline-none"
            style={{
              background: "var(--surface-raised)",
              border: "2px solid transparent",
              color: "var(--text)",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "var(--gold)";
              (e.target as HTMLInputElement).style.background = "var(--surface-high)";
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "transparent";
              (e.target as HTMLInputElement).style.background = "var(--surface-raised)";
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {debouncedQuery === "" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <SearchIcon size={36} style={{ color: "var(--text-subtle)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Search your library
            </p>
          </div>
        ) : resultsQuery.isPending ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2"
              style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
            />
          </div>
        ) : results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No results for &ldquo;{debouncedQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <p className="shrink-0 px-6 py-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{debouncedQuery}
              &rdquo;
            </p>
            <div className="min-h-0 flex-1 overflow-hidden">
              <TrackList tracks={results} showAlbum />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
