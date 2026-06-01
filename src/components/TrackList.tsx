import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { Play } from 'lucide-react'
import type { Track } from '@/api'
import { usePlayerStore } from '@/state/player'
import { usePlayback } from '@/hooks/usePlayback'
import { formatDuration, cn } from '@/lib/utils'

interface Props {
  tracks: Track[]
}

export function TrackList({ tracks }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { currentTrack, isPlaying } = usePlayerStore()
  const { play } = usePlayback()

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  })

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--text-3)] text-sm">No tracks</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {/* Header */}
        <div
          className="sticky top-0 flex items-center px-4 py-2 border-b text-[11px] font-medium uppercase tracking-wider z-10"
          style={{
            color: 'var(--text-3)',
            borderColor: 'var(--separator)',
            background: 'var(--bg)',
          }}
        >
          <span className="w-8 shrink-0">#</span>
          <span className="flex-1">Title</span>
          <span className="w-32 hidden md:block">Album</span>
          <span className="w-16 text-right">Time</span>
        </div>

        {virtualizer.getVirtualItems().map(vItem => {
          const track = tracks[vItem.index]
          const isCurrent = currentTrack?.id === track.id

          return (
            <div
              key={track.id}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: vItem.start, left: 0, right: 0 }}
              className={cn(
                'flex items-center px-4 h-12 group transition-colors cursor-pointer',
                isCurrent
                  ? 'bg-[var(--accent)]/5'
                  : 'hover:bg-black/4 dark:hover:bg-white/4',
              )}
              onDoubleClick={() => play(track.id)}
            >
              {/* Index / now-playing */}
              <div className="w-8 shrink-0 flex items-center justify-center">
                {isCurrent && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    <div className="playing-dot" />
                    <div className="playing-dot" />
                    <div className="playing-dot" />
                  </div>
                ) : (
                  <>
                    <span
                      className="text-[12px] tabular-nums group-hover:hidden"
                      style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-3)' }}
                    >
                      {vItem.index + 1}
                    </span>
                    <button
                      onClick={() => play(track.id)}
                      className="hidden group-hover:flex"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </>
                )}
              </div>

              {/* Title + artist */}
              <div className="flex-1 min-w-0 mr-4">
                <p
                  className="text-[14px] truncate font-medium"
                  style={{ color: isCurrent ? 'var(--accent)' : 'var(--text)' }}
                >
                  {track.title}
                </p>
                <p className="text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                  {track.artist ?? 'Unknown artist'}
                </p>
              </div>

              {/* Album */}
              <span
                className="w-32 hidden md:block text-[13px] truncate"
                style={{ color: 'var(--text-3)' }}
              >
                {track.album ?? ''}
              </span>

              {/* Duration */}
              <div className="w-16 flex items-center justify-end gap-2">
                {track.codec && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-mono uppercase hidden group-hover:inline"
                    style={{ background: 'var(--border)', color: 'var(--text-3)' }}
                  >
                    {track.codec.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)}
                  </span>
                )}
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                  {formatDuration(track.duration_ms ?? 0)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
