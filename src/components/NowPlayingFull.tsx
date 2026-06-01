import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat } from 'lucide-react'
import { usePlayerStore } from '@/state/player'
import { usePlayback } from '@/hooks/usePlayback'
import { formatDuration, coverUrl } from '@/lib/utils'

export function NowPlayingFull() {
  const { currentTrack, isPlaying, positionMs, durationMs, volume, shuffle, repeat, isFullScreen } =
    usePlayerStore()
  const { togglePlay, seek, setVolume } = usePlayback()
  const { setFullScreen, setRepeat, setShuffle } = usePlayerStore()

  return (
    <AnimatePresence>
      {isFullScreen && currentTrack && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'var(--bg)', backdropFilter: 'blur(40px)' }}
        >
          {/* Close */}
          <button
            onClick={() => setFullScreen(false)}
            className="absolute top-5 left-5 p-2 rounded-full"
            style={{ color: 'var(--text-2)' }}
          >
            <ChevronDown size={24} />
          </button>

          {/* Album art */}
          <div
            className="w-[280px] h-[280px] rounded-3xl overflow-hidden mb-8"
            style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
          >
            {coverUrl(currentTrack.cover_hash) ? (
              <img
                src={coverUrl(currentTrack.cover_hash)}
                alt={currentTrack.album ?? ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-6xl"
                style={{ background: 'var(--surface-raised)' }}
              >
                ♪
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="text-center mb-8 px-8 max-w-sm w-full">
            <p className="text-xl font-semibold truncate mb-1" style={{ color: 'var(--text)' }}>
              {currentTrack.title}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              {currentTrack.artist ?? 'Unknown artist'}
              {currentTrack.album && ` · ${currentTrack.album}`}
            </p>
          </div>

          {/* Scrubber */}
          <div className="w-full max-w-sm px-8 mb-6">
            <input
              type="range"
              min={0}
              max={durationMs || 100}
              value={positionMs}
              onChange={e => seek(Number(e.target.value))}
              className="w-full appearance-none cursor-pointer h-1 rounded-full"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                {formatDuration(positionMs)}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                {formatDuration(durationMs)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => setShuffle(!shuffle)}
              className="p-2 rounded-full transition-colors"
              style={{ color: shuffle ? 'var(--accent)' : 'var(--text-3)' }}
            >
              <Shuffle size={20} />
            </button>

            <button className="p-2 rounded-full" style={{ color: 'var(--text-2)' }}>
              <SkipBack size={24} />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{ background: 'var(--accent)', color: '#fff' }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
            </button>

            <button className="p-2 rounded-full" style={{ color: 'var(--text-2)' }}>
              <SkipForward size={24} />
            </button>

            <button
              onClick={() => setRepeat(repeat === 'Off' ? 'All' : repeat === 'All' ? 'One' : 'Off')}
              className="p-2 rounded-full transition-colors"
              style={{ color: repeat !== 'Off' ? 'var(--accent)' : 'var(--text-3)' }}
            >
              <Repeat size={20} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 w-full max-w-sm px-8">
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="flex-1 h-1 appearance-none cursor-pointer rounded-full"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>🔊</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
