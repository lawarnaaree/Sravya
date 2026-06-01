import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Trash2,
  FolderPlus,
  Loader2,
  Download,
  Moon,
  Sun,
  QrCode,
  Smartphone,
  Cloud,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/api";
import { useLibraryStore } from "@/state/library";
import EqualizerPanel from "@/components/EqualizerPanel";
import { useTheme } from "@/hooks/useTheme";

function ScanProgressBar() {
  const { isScanning, scanProgress } = useLibraryStore();
  if (!isScanning) return null;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={11} className="animate-spin" />
          Scanning…
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-subtle)" }}>
          {Math.round(scanProgress * 100)}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--overlay)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.round(scanProgress * 100)}%`,
            background: "var(--gold)",
          }}
        />
      </div>
    </div>
  );
}

function DownloadSettings() {
  const queryClient = useQueryClient();
  const [changingDir, setChangingDir] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["download-settings"],
    queryFn: () => api.import.getSettings(),
  });

  const setDirMutation = useMutation({
    mutationFn: (path: string) => api.import.setSettings(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-settings"] });
    },
  });

  const handleChangeDir = async () => {
    setChangingDir(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        await setDirMutation.mutateAsync(selected);
      }
    } catch (e) {
      console.error("Failed to set download dir:", e);
    } finally {
      setChangingDir(false);
    }
  };

  return (
    <section className="mb-6">
      <h2
        className="mb-3 text-sm font-semibold tracking-wider uppercase"
        style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
      >
        YouTube Downloads
      </h2>
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Copy a YouTube link while Sravya is open — it will offer to download it as MP3 and add it
          to your library automatically.
        </p>

        <div
          className="mb-4 flex items-center gap-3 rounded-lg px-3 py-2"
          style={{ background: "var(--surface-raised)" }}
        >
          <FolderOpen size={14} className="shrink-0" style={{ color: "var(--gold)" }} />
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs"
            style={{ color: "var(--text)" }}
            title={settings?.downloadDir ?? "~/Music/Sravya Downloads (default)"}
          >
            {settings?.downloadDir ?? "~/Music/Sravya Downloads (default)"}
          </span>
        </div>

        <button
          onClick={handleChangeDir}
          disabled={changingDir || setDirMutation.isPending}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: "var(--gold)", color: "var(--text-on-gold)" }}
        >
          {changingDir ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Change Download Folder
        </button>

        <p className="mt-3 text-xs" style={{ color: "var(--text-subtle)" }}>
          Requires <code>yt-dlp</code> and <code>ffmpeg</code> on PATH. Install:{" "}
          <code>winget install yt-dlp.yt-dlp</code> and <code>winget install Gyan.FFmpeg</code>
        </p>
      </div>
    </section>
  );
}

function DevicePairingSection() {
  const queryClient = useQueryClient();
  const [pairingInfo, setPairingInfo] = useState<{
    pairingUri: string;
    serverAddress: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: devices = [] } = useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => api.lan.getPairedDevices(),
    refetchInterval: 5000,
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => api.lan.revokeDevice(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paired-devices"] }),
  });

  const handleShowQr = async () => {
    setGenerating(true);
    try {
      const info = await api.lan.beginPairing();
      setPairingInfo({ pairingUri: info.pairingUri, serverAddress: info.serverAddress });
    } catch (e) {
      console.error("begin_pairing failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="mb-6">
      <h2
        className="mb-3 text-sm font-semibold tracking-wider uppercase"
        style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
      >
        iPhone Sync
      </h2>
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Pair your iPhone to sync your music library over WiFi. Open Sravya on iPhone → Sync tab →
          Find Desktop, or scan the QR code below.
        </p>

        {pairingInfo ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl p-4" style={{ background: "#fff" }}>
              <QRCodeSVG value={pairingInfo.pairingUri} size={180} />
            </div>
            <p className="text-center text-xs" style={{ color: "var(--text-subtle)" }}>
              Scan with the Sravya iOS app to pair
            </p>
            <p className="font-mono text-xs" style={{ color: "var(--text-subtle)" }}>
              {pairingInfo.serverAddress}
            </p>
            <button
              onClick={() => setPairingInfo(null)}
              className="text-xs underline"
              style={{ color: "var(--text-subtle)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleShowQr}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: "var(--gold)", color: "var(--text-on-gold)" }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
            Show Pairing QR Code
          </button>
        )}

        {devices.length > 0 && (
          <div className="mt-4">
            <p
              className="mb-2 text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--text-subtle)" }}
            >
              Paired Devices
            </p>
            <div className="flex flex-col gap-1">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: "var(--surface-raised)" }}
                >
                  <Smartphone size={14} className="shrink-0" style={{ color: "var(--gold)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" style={{ color: "var(--text)" }}>
                      {device.name}
                    </p>
                    {device.lastSeenAt && (
                      <p className="truncate text-xs" style={{ color: "var(--text-subtle)" }}>
                        Last seen {new Date(device.lastSeenAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => revokeMutation.mutate(device.id)}
                    disabled={revokeMutation.isPending}
                    className="shrink-0 rounded p-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "#ef4444" }}
                    aria-label="Revoke"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CloudSyncSection() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<{ apiUrl: string; apiKey: string; autoSync: boolean } | null>(
    null
  );
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    uploaded: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["cloud-settings"],
    queryFn: () => api.cloud.getSettings(),
    select: (s) => ({ apiUrl: s.apiUrl ?? "", apiKey: s.apiKey ?? "", autoSync: s.autoSync }),
  });

  const { data: status } = useQuery({
    queryKey: ["cloud-status"],
    queryFn: () => api.cloud.getStatus(),
    refetchInterval: 10_000,
  });

  const saveMutation = useMutation({
    mutationFn: (v: { apiUrl: string; apiKey: string; autoSync: boolean }) =>
      api.cloud.setSettings(v.apiUrl, v.apiKey, v.autoSync),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloud-settings"] });
      queryClient.invalidateQueries({ queryKey: ["cloud-status"] });
      setForm(null);
    },
  });

  const values = form ?? settings ?? { apiUrl: "", apiKey: "", autoSync: false };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const report = await api.cloud.syncAll();
      setSyncResult(report);
      queryClient.invalidateQueries({ queryKey: ["cloud-status"] });
    } catch (e) {
      console.error("cloud sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="mb-6">
      <h2
        className="mb-3 text-sm font-semibold tracking-wider uppercase"
        style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
      >
        Cloud Sync
      </h2>
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Uploads your music to your personal server so your iPhone can pull tracks from anywhere —
          not just over WiFi.
        </p>

        {/* Server URL */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
            Server URL
          </label>
          <input
            type="url"
            placeholder="https://api.lawarnaaree.com.np"
            value={values.apiUrl}
            onChange={(e) => setForm({ ...values, apiUrl: e.target.value })}
            className="w-full rounded-lg px-3 py-2 font-mono text-sm outline-none"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {/* API Key */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
            API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              placeholder="Paste your API key"
              value={values.apiKey}
              onChange={(e) => setForm({ ...values, apiKey: e.target.value })}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm outline-none"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 rounded-lg px-3 py-2 text-sm transition-opacity"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text-subtle)",
              }}
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Auto-sync toggle */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--text)" }}>
            Auto-sync after download
          </span>
          <button
            onClick={() => setForm({ ...values, autoSync: !values.autoSync })}
            className="relative h-6 w-11 rounded-full transition-colors"
            style={{ background: values.autoSync ? "var(--gold)" : "var(--overlay)" }}
            role="switch"
            aria-checked={values.autoSync}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{
                transform: values.autoSync ? "translateX(1.25rem)" : "translateX(0.125rem)",
              }}
            />
          </button>
        </div>

        {/* Save button */}
        {form && (
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--gold)", color: "var(--text-on-gold)" }}
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Settings
          </button>
        )}

        {/* Status + sync button */}
        <div className="flex items-center gap-3">
          {status?.isConfigured ? (
            <>
              {status.lastSyncedAt && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
                  Last synced {new Date(status.lastSyncedAt).toLocaleString()}
                </div>
              )}
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sync All Now
              </button>
            </>
          ) : (
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--text-subtle)" }}
            >
              <Cloud size={12} />
              Enter server URL and API key above to enable cloud sync
            </div>
          )}
        </div>

        {syncResult && (
          <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Done — {syncResult.uploaded} uploaded, {syncResult.skipped} skipped
            {syncResult.errors > 0 ? `, ${syncResult.errors} errors` : ""}
          </p>
        )}
      </div>
    </section>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.library.stats(),
  });

  const watchedFolders = stats?.watchedFolders ?? [];

  const addFolderMutation = useMutation({
    mutationFn: (path: string) => api.library.addFolder(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const removeFolderMutation = useMutation({
    mutationFn: (path: string) => api.library.removeFolder(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleAddFolder = async () => {
    setAddingFolder(true);
    setFolderError(null);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        await addFolderMutation.mutateAsync(selected);
      }
    } catch (e) {
      setFolderError(`Failed to add folder: ${String(e)}`);
    } finally {
      setAddingFolder(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Settings
        </h1>

        {/* Appearance */}
        <section className="mb-6">
          <h2
            className="mb-3 text-sm font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
          >
            Appearance
          </h2>
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
              Choose your preferred colour theme.
            </p>
            <div className="flex gap-3">
              {/* Dark */}
              <button
                onClick={() => setTheme("dark")}
                style={{
                  flex: 1,
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  border: theme === "dark" ? "2px solid var(--gold)" : "2px solid var(--border)",
                  cursor: "pointer",
                  background: "none",
                  padding: 0,
                  transition: "border-color 0.15s",
                }}
                aria-label="Dark theme"
              >
                {/* Preview swatch */}
                <div style={{ background: "#121212", padding: "0.75rem 1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "#c9943a" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "#ffffff",
                          width: "60%",
                          marginBottom: 4,
                        }}
                      />
                      <div
                        style={{ height: 4, borderRadius: 2, background: "#6a6a6a", width: "40%" }}
                      />
                    </div>
                  </div>
                  <div
                    style={{ height: 3, borderRadius: 2, background: "#282828", marginBottom: 4 }}
                  />
                  <div
                    style={{ height: 3, borderRadius: 2, background: "#282828", width: "75%" }}
                  />
                </div>
                <div
                  style={{
                    background: "#000000",
                    padding: "0.4rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <Moon size={12} color="#c9943a" />
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#ffffff" }}>
                    Dark
                  </span>
                  {theme === "dark" && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#c9943a",
                        display: "block",
                      }}
                    />
                  )}
                </div>
              </button>

              {/* Light */}
              <button
                onClick={() => setTheme("light")}
                style={{
                  flex: 1,
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  border: theme === "light" ? "2px solid var(--gold)" : "2px solid var(--border)",
                  cursor: "pointer",
                  background: "none",
                  padding: 0,
                  transition: "border-color 0.15s",
                }}
                aria-label="Light theme"
              >
                <div style={{ background: "#f8f5f0", padding: "0.75rem 1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "#c9943a" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "#0a0a0a",
                          width: "60%",
                          marginBottom: 4,
                        }}
                      />
                      <div
                        style={{ height: 4, borderRadius: 2, background: "#8a8a8a", width: "40%" }}
                      />
                    </div>
                  </div>
                  <div
                    style={{ height: 3, borderRadius: 2, background: "#e0dbd3", marginBottom: 4 }}
                  />
                  <div
                    style={{ height: 3, borderRadius: 2, background: "#e0dbd3", width: "75%" }}
                  />
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    padding: "0.4rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <Sun size={12} color="#c9943a" />
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f0f1b" }}>
                    Light
                  </span>
                  {theme === "light" && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#c9943a",
                        display: "block",
                      }}
                    />
                  )}
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Music Library */}
        <section className="mb-6">
          <h2
            className="mb-3 text-sm font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
          >
            Music Library
          </h2>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
              Sravya watches these folders for music files. New files are added automatically.
            </p>

            {/* Folder list */}
            {watchedFolders.length > 0 && (
              <div className="mb-3 flex flex-col gap-1">
                {watchedFolders.map((folder) => (
                  <div
                    key={folder}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ background: "var(--surface-raised)" }}
                  >
                    <FolderOpen size={14} className="shrink-0" style={{ color: "var(--gold)" }} />
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-xs"
                      style={{ color: "var(--text)" }}
                      title={folder}
                    >
                      {folder}
                    </span>
                    <button
                      className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--text-subtle)" }}
                      onClick={() => removeFolderMutation.mutate(folder)}
                      disabled={removeFolderMutation.isPending}
                      aria-label={`Remove ${folder}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Scan progress */}
            <ScanProgressBar />

            {/* Add folder button */}
            <button
              onClick={handleAddFolder}
              disabled={addingFolder || addFolderMutation.isPending}
              className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: "var(--gold)",
                color: "var(--text-on-gold)",
              }}
            >
              {addingFolder ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FolderPlus size={14} />
              )}
              Add Folder
            </button>
            {folderError && (
              <p className="mt-2 text-xs" style={{ color: "#ef4444" }}>
                {folderError}
              </p>
            )}
          </div>
        </section>

        {/* YouTube Downloads */}
        <DownloadSettings />

        {/* Equalizer */}
        <section className="mb-6">
          <h2
            className="mb-3 text-sm font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
          >
            Equalizer
          </h2>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <EqualizerPanel />
          </div>
        </section>

        {/* Device Pairing */}
        <DevicePairingSection />

        {/* Cloud Sync */}
        <CloudSyncSection />

        {/* Connected accounts */}
        <section>
          <h2
            className="mb-3 text-sm font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
          >
            Connected Accounts
          </h2>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Metadata sync from Spotify, YouTube Music, and Apple Music — Phase 5.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
