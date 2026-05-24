import { useState } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle, Loader2, Smartphone } from "lucide-react";
import { api } from "@/api";
import { useLanSyncStore, type DiscoveredServer } from "@/state/lanSync";
import type { LanSyncReport } from "@/api";

function DiscoveryPanel({ onPaired }: { onPaired: () => void }) {
  const [searching, setSearching] = useState(false);
  const { discoveredServers, setDiscoveredServers } = useLanSyncStore();
  const [pairing, setPairing] = useState<string | null>(null);
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

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
        Make sure your iPhone and computer are on the same WiFi network.
      </p>

      <button
        onClick={handleDiscover}
        disabled={searching}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60"
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

      {error && (
        <p className="mb-3 text-sm" style={{ color: "#ef4444" }}>
          {error}
        </p>
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
