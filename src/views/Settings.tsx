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

export default function Settings() {
  const queryClient = useQueryClient();
  const [addingFolder, setAddingFolder] = useState(false);
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
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        await addFolderMutation.mutateAsync(selected);
      }
    } catch (e) {
      console.error("Failed to add folder:", e);
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
