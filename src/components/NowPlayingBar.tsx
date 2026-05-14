import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
} from "lucide-react";
import { usePlayerStore } from "@/state/player";
import { api } from "@/api";
import { cn, formatDuration, coverUrl } from "@/lib/utils";

export default function NowPlayingBar() {
  const { state, currentTrack, positionMs, durationMs, volume, muted, shuffle, repeat } =
    usePlayerStore();

  const isPlaying = state === "playing";
  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const handlePlayPause = () => {
    if (isPlaying) api.playback.pause();
    else api.playback.resume();
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    api.playback.seek(Number(e.target.value));
  };

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

  const codecIsLossless = currentTrack?.codec === "FLAC" || currentTrack?.codec === "ALAC";

  return (
    <footer
      className="flex shrink-0 items-center gap-4 px-4"
      style={{
        height: "var(--nowplay-h)",
        background: "var(--surface)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {/* Track info — left third */}
      <div className="flex w-56 min-w-0 items-center gap-3">
        {currentTrack ? (
          <>
            {coverUrl(currentTrack.coverPath) ? (
              <img
                src={coverUrl(currentTrack.coverPath)}
                alt={currentTrack.album}
                className="glow-gold h-12 w-12 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm"
                style={{ background: "var(--surface-raised)" }}
              >
                <Music2 size={16} style={{ color: "var(--text-subtle)" }} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                {currentTrack.title}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {currentTrack.artist}
              </p>
              {codecIsLossless && (
                <span
                  className="mt-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold tracking-wider"
                  style={{
                    background: "rgba(201,148,58,0.12)",
                    color: "var(--gold)",
                    border: "1px solid rgba(201,148,58,0.25)",
                  }}
                >
                  {currentTrack.codec}
                </span>
              )}
            </div>
          </>
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm"
            style={{ background: "var(--surface-raised)" }}
          >
            <Music2 size={16} style={{ color: "var(--text-subtle)" }} />
          </div>
        )}
      </div>

      {/* Controls + scrubber — center */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        {/* Transport buttons */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => api.playback.command({ type: "setShuffle", enabled: !shuffle })}
            className={cn(
              "transition-colors",
              shuffle ? "text-[var(--gold)]" : "text-[var(--text-subtle)] hover:text-[var(--text)]"
            )}
            aria-label="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          <button
            onClick={() => api.playback.previous()}
            className="transition-colors hover:text-[var(--text)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Previous"
          >
            <SkipBack size={18} />
          </button>

          {/* Play / Pause — gold circle */}
          <button
            onClick={handlePlayPause}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              background: "var(--gold)",
              color: "var(--text-on-gold)",
              boxShadow: isPlaying ? "0 0 14px var(--gold-glow)" : undefined,
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </button>

          <button
            onClick={() => api.playback.next()}
            className="transition-colors hover:text-[var(--text)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Next"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={() =>
              api.playback.command({
                type: "setRepeat",
                mode: repeat === "off" ? "all" : repeat === "all" ? "one" : "off",
              })
            }
            className={cn(
              "transition-colors",
              repeat !== "off"
                ? "text-[var(--gold)]"
                : "text-[var(--text-subtle)] hover:text-[var(--text)]"
            )}
            aria-label="Repeat"
          >
            <RepeatIcon size={15} />
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex w-full max-w-md items-center gap-2">
          <span
            className="w-9 text-right text-[11px] tabular-nums"
            style={{ color: "var(--text-subtle)" }}
          >
            {formatDuration(positionMs)}
          </span>
          <input
            type="range"
            className="scrubber flex-1"
            min={0}
            max={durationMs || 100}
            value={positionMs}
            style={
              {
                "--pct": `${progress}%`,
              } as React.CSSProperties
            }
            onChange={handleScrub}
            aria-label="Seek"
          />
          <span className="w-9 text-[11px] tabular-nums" style={{ color: "var(--text-subtle)" }}>
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Volume — right third */}
      <div className="flex w-40 items-center justify-end gap-2">
        <button
          onClick={() => api.playback.command({ type: muted ? "unmute" : "mute" })}
          style={{ color: "var(--text-muted)" }}
          className="transition-colors hover:text-[var(--text)]"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <VolumeIcon size={15} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => api.playback.setVolume(Number(e.target.value))}
          className="w-20"
          aria-label="Volume"
        />
      </div>
    </footer>
  );
}
