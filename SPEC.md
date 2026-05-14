# Sravya — Local-First Music App: Implementation Plan

## Context

Sravya is a desktop music app that gives the user a Spotify-grade UI and Apple-Music-grade audio quality on a strictly **local-first** foundation. The user owns their library, builds their own playlists, and pays nothing — everything runs on their machine.

Three features make this non-trivial:

1. **High-fidelity audio** (lossless FLAC/ALAC, gapless, bit-perfect, ReplayGain) on top of a polished UI.
2. **"Paste-a-link" import** restricted to legally permissible sources (Bandcamp, Internet Archive, Free Music Archive, Jamendo, SoundCloud-allowed, Creative-Commons-flagged YouTube, user's own uploads). DRM-protected content (Spotify / Apple Music audio) is **technically impossible** to legitimately decrypt and is explicitly out of scope; the app refuses those links with a clear message.
3. **End-to-end encrypted playlist sharing** so users can share curated playlists without a server seeing their data.

Account sync (Spotify / YouTube / Apple Music) is implemented as **metadata-only** via the providers' official OAuth APIs — the app imports the user's playlists and listening history, then matches tracks against their local library or surfaces "find these tracks" prompts. No DRM bypass anywhere.

Decisions locked in with the user before this plan: **Tauri + React + Rust**, **desktop (Win/Mac/Linux) first**, **permitted-sources-only link import**, **solo developer pacing**.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.x** | ~5–10 MB bundle, Rust core, OS-native webview. Bit-perfect audio is realistic, attack surface is small, signed updates built-in. |
| Frontend | **React 18 + TypeScript + Vite** | Largest UI ecosystem; needed for the Spotify-grade feel. |
| Styling | **Tailwind CSS + Radix UI primitives** | Composable, accessible; avoids reinventing menus, dialogs, sliders. |
| Animation | **Framer Motion** | View transitions, now-playing morph, list reorder. |
| Client state | **Zustand** + **TanStack Query** | Zustand for UI state, TanStack Query for Rust-backend reads with caching. |
| Virtualization | **TanStack Virtual** | Libraries of 50k+ tracks need this. |
| Audio decode | **symphonia** (Rust) | FLAC, ALAC, MP3, AAC, OGG/Opus, WAV, AIFF — pure Rust, no FFmpeg dep. |
| Audio output | **cpal** + **rodio** | cpal for WASAPI/CoreAudio/ALSA, rodio for queue + ramp/fade. |
| Resampling | **rubato** | High-quality SRC when output device sample rate ≠ source. |
| DSP / EQ | **fundsp** or hand-rolled biquads | 10-band EQ, ReplayGain volume, optional crossfeed. |
| DB | **SQLite via sqlx** | Compile-time-checked queries. Optionally **SQLCipher** if user enables master password. |
| Search | **tantivy** | Lucene-class FTS over title/artist/album/lyrics. |
| Tag I/O | **lofty-rs** | Read+write ID3v2, Vorbis, MP4, APE; cover art extraction. |
| File watch | **notify** | Live library updates when files change on disk. |
| HTTP | **reqwest** | OAuth, MusicBrainz, source-API calls. |
| Crypto | **age** (X25519 + ChaCha20-Poly1305) + **ed25519-dalek** | Modern, audited; identity signing + share encryption. |
| Secret storage | **keyring-rs** | OS keychain (Windows Credential Manager, Keychain, Secret Service). |
| Hashing | **argon2** | Optional master password → DB key derivation. |
| External sidecar | **yt-dlp** binary bundled via Tauri sidecar | Used **only** for source modules that pass license checks. |
| Metadata enrichment | **MusicBrainz** API + **AcoustID/Chromaprint** | Free, legal, comprehensive. |
| Lyrics | **LRCLIB** API | Free synced-lyrics endpoint. |

---

## Architecture (Hexagonal)

```
                       ┌──────────────────────────────┐
                       │   React UI  (Tauri webview)  │
                       └──────────────┬───────────────┘
                            invoke()  │  events
                       ┌──────────────▼───────────────┐
                       │     Tauri commands layer     │   ← IPC surface
                       └──────────────┬───────────────┘
                                      │
   ┌──────────────────────────────────┼──────────────────────────────────┐
   │                              CORE  (pure Rust, no I/O)              │
   │  Library  •  Playback  •  Playlist  •  Importer  •  Sharing  •  Sync │
   └──────────────────────────────────┬──────────────────────────────────┘
                                      │ traits
   ┌────────────────┬──────────────┬──┴──┬────────────┬────────────────┐
   │   DB (sqlx)    │  FS (notify) │ Audio (cpal) │ HTTP (reqwest) │ Keychain │
   └────────────────┴──────────────┴───────────────┴────────────────┴──────────┘
```

Core domain is pure logic with trait-based ports. Adapters implement the ports. Solo-dev benefit: I can unit-test domain without spinning up audio or DB.

---

## Repository Layout

```
d:/Codes/sravya/
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs             # Tauri IPC entry points
│   │   ├── events.rs               # event bus → frontend
│   │   ├── core/
│   │   │   ├── library.rs          # catalog ops
│   │   │   ├── playback.rs         # state machine, queue, gapless
│   │   │   ├── playlist.rs
│   │   │   ├── importer.rs         # Source trait + dispatcher
│   │   │   ├── sharing.rs          # encrypt/decrypt playlist payloads
│   │   │   └── sync.rs             # provider metadata sync
│   │   ├── adapters/
│   │   │   ├── db.rs               # sqlx pool, migrations
│   │   │   ├── fs_scan.rs          # walker, tag read, watcher
│   │   │   ├── audio.rs            # symphonia + cpal + rodio
│   │   │   ├── ytdlp.rs            # sidecar wrapper, license gate
│   │   │   ├── musicbrainz.rs
│   │   │   ├── acoustid.rs
│   │   │   ├── lrclib.rs
│   │   │   ├── spotify.rs          # OAuth PKCE + Web API
│   │   │   ├── youtube.rs          # Google OAuth + Data API
│   │   │   └── applemusic.rs       # MusicKit dev token (Phase 5+)
│   │   ├── crypto/
│   │   │   ├── identity.rs         # Ed25519 + X25519 keypair
│   │   │   ├── sharing_crypto.rs   # age envelope, signature verify
│   │   │   └── keychain.rs         # keyring-rs wrapper
│   │   └── error.rs
│   ├── migrations/                 # sqlx migrations
│   ├── binaries/                   # yt-dlp sidecar (per-platform)
│   ├── Cargo.toml
│   └── tauri.conf.json             # locked-down allowlist
│
├── src/                            # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/                        # typed wrappers around invoke()
│   ├── state/                      # Zustand stores
│   ├── hooks/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── NowPlayingBar.tsx       # persistent bottom bar
│   │   ├── NowPlayingFull.tsx      # full-screen view, lyrics, queue
│   │   ├── TrackList.tsx           # virtualized
│   │   ├── AlbumGrid.tsx
│   │   ├── PlaylistEditor.tsx
│   │   ├── ShareDialog.tsx
│   │   ├── ImportLinkDialog.tsx
│   │   ├── EqualizerPanel.tsx
│   │   └── ConnectAccountCard.tsx
│   ├── views/
│   │   ├── Library.tsx
│   │   ├── Playlists.tsx
│   │   ├── Search.tsx
│   │   ├── Settings.tsx
│   │   └── ConnectedAccounts.tsx
│   └── styles/
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## Data Model (SQLite)

```sql
artists(id, name, mbid, sort_name)
albums(id, title, artist_id, year, mbid, cover_path)
tracks(id, title, album_id, artist_id, track_no, disc_no, duration_ms,
       file_path, file_hash, codec, bit_depth, sample_rate, bitrate,
       isrc, mbid, acoustid, replaygain_track, replaygain_album,
       added_at, last_played_at, play_count)
playlists(id, name, description, created_at, updated_at, owner_identity)
playlist_tracks(playlist_id, track_id, position, added_at)
plays(id, track_id, played_at, completed)
sources(id, kind, url, license, imported_at)        -- provenance per file
share_grants(id, recipient_pubkey, playlist_id, granted_at, revoked_at)
oauth_tokens(provider, encrypted_token, refresh_expires_at)  -- encrypted blob
```

Indexes on `tracks(album_id)`, `tracks(artist_id)`, `tracks(file_hash)`, `playlist_tracks(playlist_id, position)`. FTS via Tantivy in a sibling index dir, not in SQLite, so we can re-build without touching authoritative data.

---

## Key Subsystems

### 1. Audio playback
- Decoder thread (symphonia) → ring-buffer → output thread (cpal). UI never blocks audio.
- **Bit-perfect path**: WASAPI exclusive (Win), CoreAudio default-clock match (Mac), ALSA hw: device (Linux). Toggleable in Settings; falls back to shared mode when device is busy.
- **Gapless**: pre-decode next track into secondary buffer; swap on EOS without latency.
- **ReplayGain**: per-track/album scalar applied pre-output; user toggles "track" / "album" / "off".
- **EQ + crossfade**: optional biquad chain; crossfade configurable 0–12s.

### 2. Library scan & watch
- User adds folders → recursive walk → `lofty` tag read → SHA-256 of audio frames (not full file) for dedupe → insert.
- `notify` watches roots for adds/moves/deletes.
- Tantivy index updated on every change.
- MusicBrainz enrichment runs as background task on tracks missing `mbid`. Optional AcoustID fingerprint for truly tagless files.

### 3. Importer (`Source` trait)
```rust
trait Source {
    fn matches(&self, url: &Url) -> bool;
    fn license_check(&self, url: &Url) -> LicenseStatus;
    async fn fetch(&self, url: &Url, into: &Path) -> Result<TrackPayload>;
}
```
Implementations: `LocalFile`, `Bandcamp`, `ArchiveOrg`, `FreeMusicArchive`, `Jamendo`, `SoundCloudPermitted`, `YouTubeCC`, `UserUpload`. Dispatcher returns `Refused { reason }` for unknown or DRM-flagged URLs — surfaced verbatim in the UI. yt-dlp sidecar is invoked only after `license_check == Permitted`.

### 4. E2E playlist sharing
- On first launch, generate Ed25519 + X25519 keypair → store in OS keychain. Public key shown as a QR + base32 fingerprint in Settings.
- Sharing a playlist:
  1. Serialize `{playlist, tracks_metadata, signature_over_payload}` as JSON.
  2. Encrypt with **age** to the recipient's X25519 pubkey.
  3. Output a `.sravya-share` file. Optionally also writes a short URL-safe handoff code (BIP39 5-word) the sender reads to the recipient out-of-band; that code is a HKDF salt the recipient combines with their key to confirm authenticity.
- Receiving: drag the file into the app → verify signature against sender's pubkey → decrypt → match each track against the local library by **ISRC → MBID → AcoustID → fuzzy(artist+title+duration)** → unmatched tracks show "find this".
- No audio is ever transmitted. The recipient must already have, or separately obtain, the audio files.
- **Optional later**: LAN-direct sharing via `mdns-sd` + a noise-protocol channel; or an opt-in self-hostable relay that only sees ciphertext.

### 5. Account metadata sync
- Spotify: OAuth 2.0 PKCE (no client secret needed — perfect for desktop). Scopes: `user-library-read`, `playlist-read-private`, `user-read-recently-played`, `user-top-read`. Stores refresh token in keychain.
- YouTube: Google OAuth + YouTube Data API v3, scope `youtube.readonly`. Pulls playlists, liked videos.
- Apple Music: deferred to Phase 5+ — requires a paid Apple Developer account to mint developer tokens. Stub the UI ("Coming soon") until that's available.
- Match algorithm: ISRC (exact) → MBID (exact) → AcoustID (fingerprint) → fuzzy (Jaro-Winkler on `artist + " " + title`, with duration ±3s gate). Threshold-confident matches link automatically; below-threshold matches show in a "review" queue.

### 6. Security posture
- Tauri allowlist locked to declared paths only; no `shell` or arbitrary `fs.*`.
- Optional master password → Argon2id KDF → SQLCipher key. Without it, DB is plaintext (UX trade-off, opt-in for paranoia).
- OAuth tokens always encrypted with a key from the keychain, never on disk in cleartext.
- Auto-update via Tauri's signed updater (Ed25519 release signature).
- CSP locked down in `tauri.conf.json`; webview cannot navigate off-app.

---

## UI/UX Direction

- **Dark-default**, with optional OLED-black and a light theme.
- **Edge-to-edge album art** as the visual anchor: large hero on album pages, dominant-color extraction for backgrounds (using `palette` crate or `node-vibrant` on the frontend).
- **Persistent now-playing bar** at bottom; click to expand into a full-screen morph (Framer Motion `layoutId`).
- Full-screen now-playing has: synced lyrics (LRCLIB), upcoming queue (drag-reorderable), lossless-quality badge, ReplayGain indicator.
- **Sidebar**: Home, Search, Library (Songs/Albums/Artists/Genres), Playlists, Connected Accounts, Settings.
- **Library**: virtualized lists; album-art grids with skeleton shimmer; right-click context menus via Radix.
- **Microinteractions**: cover-art parallax on scroll, smooth scrubbing with seek-preview, animated waveform on hover, sound-quality icon (Hi-Res / Lossless / Lossy badges from codec metadata).
- **Sharing UX**: "Share Playlist" → choose recipient (paste their fingerprint or scan their QR) → app produces `.sravya-share` + handoff code → AirDrop / email / messenger to recipient.

---

## Phased Build Plan (solo developer)

Estimates assume part-time solo work; halve if full-time.

**Phase 0 — Scaffolding (3–5 days)**
- `pnpm create tauri-app` template (React + TS).
- Tooling: ESLint, Prettier, `cargo fmt`, `cargo clippy`, Husky pre-commit, Vitest, `cargo test`.
- Tauri config: allowlist locked down, sidecar slot for yt-dlp.
- CI: GitHub Actions, matrix on Win/Mac/Linux, build + test.

**Phase 1 — Local-First MVP (4–6 weeks)**
- Schema + migrations.
- Folder picker, library scan, `lofty` tag read, SHA-256 dedupe, cover-art extraction.
- File watcher.
- Audio playback (symphonia + cpal + rodio) — at least FLAC/MP3/AAC/ALAC.
- Tantivy search.
- UI: Sidebar, Library (Songs/Albums/Artists), Playlists CRUD, Now-Playing bar, Search.
- **Exit criterion**: scan a 5k-track folder, play any track, create/edit a playlist, search.

**Phase 2 — Quality + Polish (3–4 weeks)**
- Bit-perfect output paths.
- Gapless playback.
- ReplayGain scan and apply.
- 10-band EQ (optional, off by default).
- MusicBrainz enrichment background task.
- Full-screen Now-Playing view, lyrics (LRCLIB), animations, theme.
- **Exit criterion**: side-by-side A/B with foobar2000 / Apple Music shows no audible difference on lossless.

**Phase 3 — Link Import (3–4 weeks)**
- `Source` trait + dispatcher.
- yt-dlp sidecar integration with license gate.
- Adapters: Bandcamp, Archive.org, FMA, Jamendo, SoundCloud-permitted, CC-YouTube, user upload.
- Refusal UI for DRM/copyrighted links.
- Download queue UI.
- **Exit criterion**: drop a Bandcamp URL → track appears in library tagged correctly; drop a normal YouTube music video → refused with a clear message and a "manually add the file" affordance.

**Phase 4 — E2E Sharing (2–3 weeks)**
- Identity keypair generation + keychain storage.
- Pubkey fingerprint UI (QR + base32).
- Share dialog → `.sravya-share` export.
- Import flow with signature verify + match queue.
- **Exit criterion**: two devices exchange a playlist; tampered file is rejected; unmatched tracks surface for manual fixup.

**Phase 5 — Account Metadata Sync (3–4 weeks)**
- Spotify OAuth PKCE + Web API.
- YouTube OAuth + Data API.
- Match algorithm with review queue.
- Apple Music UI placeholder.
- **Exit criterion**: connect a Spotify account → see all playlists with matched tracks playable from local library + unmatched tracks listed.

**Phase 6+ — Stretch**
- Apple Music (once developer account is in place).
- Smart playlists (rule-based).
- Last.fm scrobbling.
- LAN sharing via mDNS.
- Mobile companion (React Native or Flutter; library sync over LAN).
- Optional self-hosted relay for over-internet share without exposing IPs.

---

## Critical Files / Modules to Create First

These are the load-bearing files; everything else fits around them:

- `src-tauri/src/core/library.rs` — catalog domain
- `src-tauri/src/core/playback.rs` — playback state machine
- `src-tauri/src/adapters/audio.rs` — symphonia + cpal pipeline
- `src-tauri/src/adapters/db.rs` — sqlx pool + migrations runner
- `src-tauri/src/adapters/fs_scan.rs` — walker + tag read + watcher
- `src-tauri/src/commands.rs` — IPC surface; the React/Rust contract
- `src/components/NowPlayingBar.tsx` — most-trafficked UI surface
- `src/components/TrackList.tsx` — virtualized, will be reused everywhere
- `src/api/index.ts` — typed Tauri command wrappers (single source of truth)

---

## Verification

**Per-phase smoke tests**
- Phase 1: `cargo test -p sravya-core`, `pnpm test`, `pnpm tauri dev`, manually scan + play + search.
- Phase 2: A/B listening test against foobar2000/Apple Music on the same file; check `wasapi-rs` reports exclusive-mode acquisition.
- Phase 3: Drop one permitted and one disallowed URL; confirm download succeeds for the first and refusal message for the second.
- Phase 4: Generate share on Device A, import on Device B; corrupt one byte of the share file and confirm rejection.
- Phase 5: Connect Spotify dev account, confirm playlists arrive, spot-check at least three matches and one unmatched.

**Continuous checks**
- `cargo clippy -- -D warnings`, `cargo fmt --check`
- `cargo audit`, `pnpm audit`
- Vitest + React Testing Library for UI; Tauri's `mockIPC` for command tests
- GitHub Actions matrix build on all three platforms before any release
- Signed releases via Tauri updater; verify signature on first run

**Manual exit gate before public release**
- 10k-track library scan completes under 60s on mid-range hardware.
- Cold-start time under 1.5s on SSD.
- Memory under 250 MB idle, 400 MB with full-screen now-playing active.
- Bit-perfect proof: bit-by-bit compare WASAPI capture vs source FLAC for a 60s clip.

---

## Things Explicitly Out of Scope

- Decrypting Spotify, Apple Music, or any DRM-protected audio.
- Re-uploading or hosting user audio anywhere.
- Telemetry by default (opt-in only, if added at all).
- A streaming service. This is a **player + library + sharer**, not a Spotify clone.

---

## Open Questions to Revisit During Build

- **SQLCipher cost**: adds ~1MB and some perf hit. Worth it for opt-in master password? Probably yes for the security story; revisit if perf becomes an issue.
- **Apple Music developer account**: who funds the $99/yr Apple Dev cost? Defer until Phase 5.
- **yt-dlp licensing**: bundling yt-dlp binary is fine (Unlicense), but sidecar update strategy needs design — auto-update vs ship-with-app.
- **Mobile**: deferred but the Rust core is reusable via UniFFI; design domain types with that in mind from day one.
