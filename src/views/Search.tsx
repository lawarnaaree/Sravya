import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { api } from '@/api'
import { TrackList } from '@/components/TrackList'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function Search() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 400)

  const { data: results = [] } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.tracks.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <h1 className="text-[22px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
          Search
        </h1>

        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          <SearchIcon size={16} style={{ color: 'var(--text-3)' }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tracks, artists, albums…"
            className="flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {debouncedQuery ? (
          results.length > 0 ? (
            <TrackList tracks={results} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p className="text-[15px] font-medium" style={{ color: 'var(--text-2)' }}>
                No results for "{debouncedQuery}"
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                Try a different search term
              </p>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[var(--text-3)] text-sm">Type to search your library</p>
          </div>
        )}
      </div>
    </div>
  )
}
