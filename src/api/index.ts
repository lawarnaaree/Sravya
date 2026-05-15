import { invoke } from "@tauri-apps/api/core";

// ── Types (mirror Rust structs) ────────────────────────────────────────────

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNo?: number;
  discNo?: number;
  durationMs: number;
  year?: number;
  filePath: string;
  fileHash: string;
  codec: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrate?: number;
  isrc?: string;
  mbid?: string;
  coverPath?: string;
  replaygainTrack?: number;
  replaygainAlbum?: number;
  playCount: number;
  lastPlayedAt?: string;
  addedAt: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  mbid?: string;
  coverPath?: string;
  trackCount: number;
}

export interface Artist {
  id: string;
  name: string;
  sortName?: string;
  mbid?: string;
  albumCount: number;
}

export interface LibraryStats {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  totalDurationMs: number;
  watchedFolders: string[];
}

export type PlaybackState = "stopped" | "playing" | "paused";
export type RepeatMode = "off" | "one" | "all";

export interface PlaybackStatus {
  state: PlaybackState;
  currentTrack?: Track;
  positionMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: string[];
  queueIndex: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverPath?: string;
  trackCount: number;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadJob {
  id: string;
  url: string;
  title?: string;
  progress: number;
  state: "queued" | "downloading" | "processing" | "done" | { failed: { error: string } };
}

export type ImportResult =
  | { status: "queued"; jobId: string }
  | { status: "refused"; reason: string };

export interface DownloadSettings {
  downloadDir?: string;
}

// ── Phase 2 types ──────────────────────────────────────────────────────────

export interface LyricsLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  synced: LyricsLine[];
  plain?: string;
}

export interface EqBand {
  freqHz: number;
  gainDb: number;
}

export interface EqSettings {
  enabled: boolean;
  preampDb: number;
  bands: EqBand[];
}

// ── Library ────────────────────────────────────────────────────────────────

export const api = {
  library: {
    stats: () => invoke<LibraryStats>("get_library_stats"),
    tracks: (limit: number, offset: number) => invoke<Track[]>("get_tracks", { limit, offset }),
    albums: () => invoke<Album[]>("get_albums"),
    artists: () => invoke<Artist[]>("get_artists"),
    playlistTracks: (playlistId: string) => invoke<Track[]>("get_playlist_tracks", { playlistId }),
    search: (query: string) => invoke<Track[]>("search", { query }),
    addFolder: (path: string) => invoke<void>("add_library_folder", { path }),
    removeFolder: (path: string) => invoke<void>("remove_library_folder", { path }),
  },

  playback: {
    status: () => invoke<PlaybackStatus>("get_playback_status"),
    command: (command: object) => invoke<void>("send_player_command", { command }),
    play: (trackId: string) =>
      invoke<void>("send_player_command", { command: { type: "play", track_id: trackId } }),
    pause: () => invoke<void>("send_player_command", { command: { type: "pause" } }),
    resume: () => invoke<void>("send_player_command", { command: { type: "resume" } }),
    stop: () => invoke<void>("send_player_command", { command: { type: "stop" } }),
    seek: (positionMs: number) =>
      invoke<void>("send_player_command", { command: { type: "seek", position_ms: positionMs } }),
    setVolume: (level: number) =>
      invoke<void>("send_player_command", { command: { type: "setVolume", level } }),
    next: () => invoke<void>("send_player_command", { command: { type: "next" } }),
    previous: () => invoke<void>("send_player_command", { command: { type: "previous" } }),
  },

  playlists: {
    list: () => invoke<Playlist[]>("get_playlists"),
    create: (name: string, description?: string) =>
      invoke<Playlist>("create_playlist", { req: { name, description } }),
    update: (id: string, name?: string, description?: string) =>
      invoke<void>("update_playlist", { id, req: { name, description } }),
    delete: (id: string) => invoke<void>("delete_playlist", { id }),
    addTrack: (playlistId: string, trackId: string) =>
      invoke<void>("add_to_playlist", { playlistId, trackId }),
    removeTrack: (playlistId: string, position: number) =>
      invoke<void>("remove_from_playlist", { playlistId, position }),
  },

  import: {
    url: (url: string) => invoke<ImportResult>("import_url", { req: { url } }),
    queue: () => invoke<DownloadJob[]>("get_download_queue"),
    getSettings: () => invoke<DownloadSettings>("get_download_settings"),
    setSettings: (downloadDir: string) => invoke<void>("set_download_settings", { downloadDir }),
  },

  lyrics: {
    get: (trackId: string) => invoke<LyricsData | null>("get_lyrics", { trackId }),
  },

  eq: {
    getSettings: () => invoke<EqSettings>("get_eq_settings"),
    setSettings: (settings: EqSettings) => invoke<void>("set_eq_settings", { settings }),
  },
};
