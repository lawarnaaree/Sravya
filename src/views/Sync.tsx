import { useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  Loader2,
  Smartphone,
  QrCode,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  scan,
  Format,
  checkPermissions,
  requestPermissions,
} from "@tauri-apps/plugin-barcode-scanner";
import { api } from "@/api";
import { useLanSyncStore, type DiscoveredServer } from "@/state/lanSync";
import type { LanSyncReport } from "@/api";
import { usePlatform } from "@/hooks/usePlatform";

function parsePairingUri(uri: string): { serverAddress: string; challenge: string } | null {
  if (!uri.startsWith("sravya://pair")) return null;
  // URL parser chokes on the custom scheme + missing slashes, so swap to http:// for parsing.
  const u = new URL(uri.replace(/^sravya:\/\/pair/, "http://pair"));
  const host = u.searchParams.get("host");
  const port = u.searchParams.get("port");
  const challenge = u.searchParams.get("challenge");
  if (!host || !port || !challenge) return null;
  return { serverAddress: `http://${host}:${port}`, challenge };
}

function HotspotInstructions() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: "var(--text)" }}
      >
        <span className="flex items-center gap-2">
          <Smartphone size={16} style={{ color: "var(--gold)" }} />
          Direct Connection (No Router)
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 text-sm" style={{ color: "var(--text-muted)" }}>
          <p className="mb-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            No shared WiFi needed. Works like SHAREit — iPhone becomes the router.
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-4">
            <li>
              On iPhone: <strong>Settings → Personal Hotspot → Allow Others to Join ✓</strong>
            </li>
            <li>
              On Windows: <strong>WiFi → connect to &quot;[Your Name]&apos;s iPhone&quot;</strong>
            </li>
            <li>
              Tap <strong>&quot;Find Desktop&quot;</strong> above
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function DiscoveryPanel({ onPaired }: { onPaired: () => void }) {
  const platform = usePlatform();
  const [searching, setSearching] = useState(false);
  const { discoveredServers, setDiscoveredServers } = useLanSyncStore();
  const [pairing, setPairing] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    setSearching(true);
    setError(null);
    try {
      const servers = await api.lan.discoverServers(5);
      setDiscoveredServers(servers);
      if (servers.length === 0) setError("No Sravya desktop found on this network.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  const handlePair = async (server: DiscoveredServer) => {
    setPairing(server.address);
    setError(null);
    try {
      const { challenge } = await api.lan.initiatePairing(server.address);
      const result = await api.lan.completePairing(server.address, "My iPhone", challenge);
      if (result.success) {
        onPaired();
      } else {
        setError("Pairing failed. Make sure the code matches on both devices.");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPairing(null);
    }
  };

  const handleScanQr = async () => {
    setError(null);
    setScanning(true);
    try {
      let perm = await checkPermissions();
      if (perm !== "granted" && perm !== "denied") {
        perm = await requestPermissions();
      }
      if (perm !== "granted") {
        setError("Camera permission denied. Enable it in iOS Settings → Sravya.");
        return;
      }

      const result = await scan({ windowed: false, formats: [Format.QRCode] });
      const parsed = parsePairingUri(result.content);
      if (!parsed) {
        setError("That QR code isn't a Sravya pairing code.");
        return;
      }

      setPairing(parsed.serverAddress);
      const completion = await api.lan.completePairing(
        parsed.serverAddress,
        "My iPhone",
        parsed.challenge
      );
      if (completion.success) {
        onPaired();
      } else {
        setError("Pairing failed. Generate a fresh QR code on the desktop and try again.");
      }
    } catch (e) {
      // The plugin throws when the user cancels — don't surface that as an error.
      const msg = String(e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setPairing(null);
      setScanning(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
        Make sure your iPhone and computer are on the same WiFi network.
      </p>

      <button
        onClick={handleDiscover}
        disabled={searching || scanning}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60"
        style={{ background: "var(--gold)", color: "var(--text-on-gold)" }}
      >
        {searching ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Searching…
          </>
        ) : (
          <>
            <Wifi size={16} />
            Find Desktop
          </>
        )}
      </button>

      {platform === "ios" && (
        <button
          onClick={handleScanQr}
          disabled={searching || scanning || pairing !== null}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {scanning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Opening camera…
            </>
          ) : (
            <>
              <QrCode size={16} />
              Scan QR from Desktop
            </>
          )}
        </button>
      )}

      {error && (
        <div className="mb-3">
          <p className="text-sm" style={{ color: "#ef4444" }}>
            {error}
          </p>
          {(error.includes("Cannot reach") || error.includes("request failed")) && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              Check that Windows Firewall allows Sravya (port 41892 TCP inbound), or use Hotspot
              Mode below.
            </p>
          )}
        </div>
      )}

      {discoveredServers.length > 0 && (
        <div className="flex flex-col gap-2">
          {discoveredServers.map((server) => (
            <button
              key={server.address}
              onClick={() => handlePair(server)}
              disabled={pairing === server.address}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                opacity: pairing && pairing !== server.address ? 0.5 : 1,
              }}
            >
              <Smartphone size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {server.name.split(".")[0]}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {server.address}
                </p>
              </div>
              {pairing === server.address ? (
                <Loader2
                  size={16}
                  className="shrink-0 animate-spin"
                  style={{ color: "var(--gold)" }}
                />
              ) : (
                <span className="shrink-0 text-xs" style={{ color: "var(--text-subtle)" }}>
                  Tap to pair
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <HotspotInstructions />
    </div>
  );
}

function SyncStatusPanel() {
  const { lastSyncedAt, isSyncing, syncProgress, fileProgress } = useLanSyncStore();
  const [lastReport, setLastReport] = useState<LanSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeFiles = Object.entries(fileProgress).filter(([, p]) => p < 1);

  const handleSync = async () => {
    setError(null);
    setLastReport(null);
    try {
      const report = await api.lan.startSync();
      setLastReport(report);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <div
        className="mb-4 flex items-center gap-3 rounded-xl p-4"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        <CheckCircle size={20} style={{ color: "var(--gold)", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Connected to desktop
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
              : "Never synced"}
          </p>
        </div>
      </div>

      {isSyncing && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <Loader2 size={11} className="animate-spin" />
              Syncing…
            </span>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-subtle)" }}>
              {Math.round(syncProgress * 100)}%
            </span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full"
            style={{ background: "var(--overlay)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${syncProgress * 100}%`, background: "var(--gold)" }}
            />
          </div>
          {activeFiles.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {activeFiles.slice(0, 3).map(([hash, p]) => (
                <div key={hash} className="flex items-center gap-2">
                  <div
                    className="h-0.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--overlay)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p * 100}%`, background: "var(--gold)", opacity: 0.6 }}
                    />
                  </div>
                  <span
                    className="w-8 text-right text-[10px] tabular-nums"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {Math.round(p * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lastReport && !isSyncing && (
        <div className="mb-4 rounded-xl px-4 py-3" style={{ background: "var(--surface-raised)" }}>
          <p className="text-sm" style={{ color: "var(--text)" }}>
            {lastReport.added} added · {lastReport.skipped} already up-to-date
            {lastReport.errors > 0 && ` · ${lastReport.errors} errors`}
          </p>
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60"
        style={{ background: "var(--gold)", color: "var(--text-on-gold)" }}
      >
        {isSyncing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <RefreshCw size={16} />
            Sync Now
          </>
        )}
      </button>
    </div>
  );
}

export default function Sync() {
  const { isPaired, setPaired } = useLanSyncStore();

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Library Sync
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Syncs music from your computer to this iPhone over WiFi. No cloud required.
        </p>

        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {isPaired ? (
            <SyncStatusPanel />
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <WifiOff size={16} style={{ color: "var(--text-subtle)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Not connected
                </span>
              </div>
              <DiscoveryPanel onPaired={() => setPaired("", "Desktop")} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
