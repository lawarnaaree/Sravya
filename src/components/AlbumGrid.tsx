import { Play } from 'lucide-react'
import { coverUrl } from '@/lib/utils'
import type { Track } from '@/api'
import { usePlayback } from '@/hooks/usePlayback'

interface Album {
  name: string
  artist?: string
  cover_hash?: string
  tracks: Track[]
}

interface Props {
  albums: Album[]
}

export function AlbumGrid({ albums }: Props) {
  const { play } = usePlayback()

  if (albums.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--text-3)] text-sm">No albums</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {albums.map(album => {
          const cover = coverUrl(album.cover_hash)
          const first = album.tracks[0]

          return (
            <div
              key={`${album.name}-${album.artist}`}
              className="group cursor-pointer"
              onDoubleClick={() => first && play(first.id)}
            >
              <div
                className="relative aspect-square rounded-2xl overflow-hidden mb-2"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                {cover ? (
                  <img src={cover} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-4xl"
                    style={{ background: 'var(--surface-raised)' }}
                  >
                    ♪
                  </div>
                )}

                <button
                  onClick={() => first && play(first.id)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Play size={20} fill="white" color="white" />
                  </div>
                </button>
              </div>

              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                {album.name}
              </p>
              <p className="text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                {album.artist ?? 'Unknown artist'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
