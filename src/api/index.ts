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

// ── LAN sync types ────────────────────────────────────────────────────────

export interface DiscoveredServer {
  name: string;
  host: string;
  port: number;
  address: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  platform: string;
  pairedAt: string;
  lastSeenAt?: string;
}

export interface LanSyncReport {
  added: number;
  skipped: number;
  errors: number;
}

export interface LanServerInfo {
  address: string;
  port: number;
  serverName: string;
}

export interface PairingInfo {
  challenge: string;
  pairingUri: string;
  serverAddress: string;
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

  lan: {
    serverInfo: () => invoke<LanServerInfo>("get_lan_server_info"),
    beginPairing: () => invoke<PairingInfo>("begin_pairing"),
    getPairedDevices: () => invoke<PairedDevice[]>("get_paired_devices"),
    revokeDevice: (deviceId: string) => invoke<void>("revoke_device", { deviceId }),
    discoverServers: async (timeoutSecs?: number) => {
      // Best-effort: triggers the iOS Local Network prompt; safe to ignore if it fails.
      try {
        await invoke("trigger_local_network_prompt");
      } catch {
        // ignored
      }
      return invoke<DiscoveredServer[]>("discover_servers", { timeoutSecs: timeoutSecs ?? 5 });
    },
    initiatePairing: (serverUrl: string) =>
      invoke<{ challenge: string; serverName: string }>("pairing_begin_remote", { serverUrl }),
    completePairing: async (serverUrl: string, deviceName: string, challenge: string) => {
      const [pubkey, challengeSig] = await invoke<[string, string]>("sign_pairing_challenge", {
        challenge,
      });
      const data = await invoke<{ success: boolean; deviceId?: string }>("pairing_confirm_remote", {
        serverUrl,
        deviceName,
        devicePubkey: pubkey,
        challengeSig,
      });
      if (data.success && data.deviceId) {
        await invoke("save_lan_server", { serverUrl, deviceId: data.deviceId, pubkey });
      }
      return data;
    },
    startSync: () => invoke<LanSyncReport>("start_lan_sync"),
    getSyncStatus: () =>
      invoke<{ isPaired: boolean; lastSyncedAt?: string }>("get_lan_sync_status"),
    importUrl: (url: string) => invoke<{ jobId: string }>("import_url_remote", { url }),
  },
};
