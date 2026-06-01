import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '@/api'
import { TrackList } from '@/components/TrackList'
import { AlbumGrid } from '@/components/AlbumGrid'
import { pluralize } from '@/lib/utils'

type Tab = 'songs' | 'albums'

export function Library() {
  const [tab, setTab] = useState<Tab>('songs')
  const [search, setSearch] = useState('')

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks'],
    queryFn: api.tracks.list,
  })

  const filtered = search
    ? tracks.filter(
        t =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.artist?.toLowerCase().includes(search.toLowerCase()) ||
          t.album?.toLowerCase().includes(search.toLowerCase()),
      )
    : tracks

  const albumMap = new Map<string, typeof tracks>()
  tracks.forEach(t => {
    const key = t.album ?? 'Unknown Album'
    albumMap.set(key, [...(albumMap.get(key) ?? []), t])
  })
  const albums = Array.from(albumMap.entries()).map(([name, ts]) => ({
    name,
    artist: ts[0]?.artist,
    cover_hash: ts[0]?.cover_hash,
    tracks: ts,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: '14px' }}>
          Library
        </h1>

        {/* Search bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'var(--surface-raised)',
            boxShadow: 'var(--shadow-card)',
            marginBottom: '16px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          />
          {filtered.length > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-3)', flexShrink: 0 }}>
              {pluralize(filtered.length, 'track')}
            </span>
          )}
        </div>

        {/* Pill tabs */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--control-bg)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '12px',
          }}
        >
          {(['songs', 'albums'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                background: tab === t ? 'var(--control-active)' : 'transparent',
                color: tab === t ? 'var(--control-text)' : 'var(--control-text-inactive)',
                boxShadow: tab === t ? 'var(--control-active-shadow)' : 'none',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'songs' && (
          isLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading…</p>
            </div>
          ) : (
            <TrackList tracks={filtered} />
          )
        )}
        {tab === 'albums' && <AlbumGrid albums={albums} />}
      </div>
    </div>
  )
}
