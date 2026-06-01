import { invoke } from '@tauri-apps/api/core'

export interface Track {
  id: string
  title: string
  artist?: string
  album?: string
  track_no?: number
  duration_ms?: number
  file_hash: string
  file_ext: string
  file_path: string
  cover_hash?: string
  codec?: string
  sample_rate?: number
  bitrate?: number
  added_at: string
}

export interface Playlist {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface PlayerState {
  is_playing: boolean
  current_track_id?: string
  position_ms: number
  duration_ms: number
  volume: number
  repeat: 'Off' | 'One' | 'All'
  shuffle: boolean
}

export interface CloudSettings {
  apiUrl: string
  apiKey: string
  autoSync: boolean
}

export interface CloudSyncStatus {
  isConfigured: boolean
  isSyncing: boolean
  lastSyncedAt?: string
  lastPullAt?: string
}

export interface CloudSyncResult {
  uploaded: number
  skipped: number
  errors: number
}

export interface CloudPullResult {
  pulled: number
  skipped: number
  errors: number
  serverTime: string
}

export interface LanSyncResult {
  synced: number
  skipped: number
  errors: number
}

export const api = {
  tracks: {
    list: (): Promise<Track[]> => invoke('get_tracks'),
    get: (id: string): Promise<Track | null> => invoke('get_track', { id }),
    search: (query: string): Promise<Track[]> => invoke('search_tracks', { query }),
    delete: (id: string): Promise<void> => invoke('delete_track', { id }),
    scanLibrary: (): Promise<number> => invoke('scan_library'),
  },

  player: {
    getState: (): Promise<PlayerState> => invoke('get_player_state'),
    play: (trackId: string): Promise<void> => invoke('play_track', { trackId }),
    pause: (): Promise<void> => invoke('pause'),
    resume: (): Promise<void> => invoke('resume'),
    seek: (positionMs: number): Promise<void> => invoke('seek', { positionMs }),
    setVolume: (volume: number): Promise<void> => invoke('set_volume', { volume }),
    next: (): Promise<void> => invoke('next_track'),
    prev: (): Promise<void> => invoke('prev_track'),
  },

  playlists: {
    list: (): Promise<Playlist[]> => invoke('get_playlists'),
    create: (name: string): Promise<Playlist> => invoke('create_playlist', { name }),
    delete: (id: string): Promise<void> => invoke('delete_playlist', { id }),
    tracks: (playlistId: string): Promise<Track[]> => invoke('get_playlist_tracks', { playlistId }),
    addTrack: (playlistId: string, trackId: string, position: number): Promise<void> =>
      invoke('add_to_playlist', { playlistId, trackId, position }),
  },

  settings: {
    get: (key: string): Promise<string | null> => invoke('get_setting', { key }),
    set: (key: string, value: string): Promise<void> => invoke('set_setting', { key, value }),
  },

  cloud: {
    getSettings: (): Promise<CloudSettings> => invoke('get_cloud_settings'),
    setSettings: (settings: CloudSettings): Promise<void> => invoke('set_cloud_settings', { settings }),
    getStatus: (): Promise<CloudSyncStatus> => invoke('get_cloud_sync_status'),
    uploadTrack: (trackId: string): Promise<void> => invoke('upload_track_to_cloud', { trackId }),
    syncAll: (): Promise<CloudSyncResult> => invoke('sync_all_to_cloud'),
    pull: (): Promise<CloudPullResult> => invoke('pull_from_cloud'),
  },

  lan: {
    startServer: (): Promise<void> => invoke('start_lan_server'),
    stopServer: (): Promise<void> => invoke('stop_lan_server'),
    getStatus: (): Promise<{ running: boolean; port: number }> => invoke('get_lan_server_status'),
    getPairingQr: (): Promise<string> => invoke('get_pairing_qr_code'),
    scanQrAndConnect: (url: string): Promise<void> => invoke('scan_qr_and_connect', { url }),
    startSync: (): Promise<LanSyncResult> => invoke('start_lan_sync'),
    getSyncStatus: (): Promise<{ connected: boolean; url?: string }> => invoke('get_lan_sync_status'),
  },

  import: {
    url: (url: string): Promise<string> => invoke('import_url', { url }),
  },
}
