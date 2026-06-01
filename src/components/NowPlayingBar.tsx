import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { usePlayerStore } from '@/state/player'
import { usePlayback } from '@/hooks/usePlayback'
import { formatDuration, coverUrl } from '@/lib/utils'

export function NowPlayingBar() {
  const { currentTrack, isPlaying, positionMs, durationMs, volume, muted } = usePlayerStore()
  const { togglePlay, seek, setVolume } = usePlayback()
  const { setFullScreen, setMuted } = usePlayerStore()

  const barStyle: React.CSSProperties = {
    height: '80px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 20px',
    background: 'var(--player)',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    borderTop: '1px solid var(--separator)',
    boxShadow: 'var(--shadow-player)',
  }

  if (!currentTrack) {
    return (
      <div style={{ ...barStyle, justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Nothing playing</span>
      </div>
    )
  }

  const cover = coverUrl(currentTrack.cover_hash)

  return (
    <div style={barStyle}>
      {/* Track info — left */}
      <button
        onClick={() => setFullScreen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '220px',
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {cover ? (
            <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '20px', color: 'var(--text-3)' }}>♪</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTrack.title}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}
          >
            {currentTrack.artist ?? 'Unknown artist'}
          </p>
        </div>
      </button>

      {/* Center — controls + scrubber */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: 'var(--text-2)' }}
            aria-label="Previous"
          >
            <SkipBack size={17} />
          </button>

          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,122,255,0.4)',
              transition: 'transform 0.1s ease',
            }}
          >
            {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={() => {}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: 'var(--text-2)' }}
            aria-label="Next"
          >
            <SkipForward size={17} />
          </button>
        </div>

        {/* Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '400px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {formatDuration(positionMs)}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={positionMs}
            onChange={e => seek(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: '3px' }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Right — volume + codec + expand */}
      <div style={{ width: '200px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        {currentTrack.codec && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '5px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              background: 'var(--border)',
              color: 'var(--text-3)',
              letterSpacing: '0.03em',
            }}
          >
            {currentTrack.codec.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)}
          </span>
        )}

        <button
          onClick={() => setMuted(!muted)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px' }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={e => setVolume(Number(e.target.value))}
          style={{ width: '72px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          aria-label="Volume"
        />

        <button
          onClick={() => setFullScreen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px' }}
          aria-label="Expand"
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  )
}
