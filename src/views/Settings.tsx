import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Trash2, FolderPlus, Loader2 } from "lucide-react";
import { api } from "@/api";
import { useLibraryStore } from "@/state/library";

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

export default function Settings() {
  const queryClient = useQueryClient();
  const [addingFolder, setAddingFolder] = useState(false);

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

        {/* Audio */}
        <section className="mb-6">
          <h2
            className="mb-3 text-sm font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
          >
            Audio
          </h2>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Bit-perfect output, gapless playback, ReplayGain, and 10-band EQ are coming in Phase
              2.
            </p>
          </div>
        </section>

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
