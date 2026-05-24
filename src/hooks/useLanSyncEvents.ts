import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useLanSyncStore } from "@/state/lanSync";

export function useLanSyncEvents() {
  const { setSyncing, setFileProgress } = useLanSyncStore();

  useEffect(() => {
    const unlisten: Array<() => void> = [];

    listen<void>("lan-sync-started", () => {
      setSyncing(true, 0);
    }).then((u) => unlisten.push(u));

    listen<{ current: number; total: number; progress: number }>("lan-sync-progress", (e) => {
      setSyncing(true, e.payload.progress);
    }).then((u) => unlisten.push(u));

    listen<{ added: number; skipped: number; errors: number; error?: string }>(
      "lan-sync-complete",
      () => {
        setSyncing(false, 1);
      }
    ).then((u) => unlisten.push(u));

    listen<{ hash: string; downloaded: number; total: number; progress: number }>(
      "lan-sync-file-progress",
      (e) => {
        setFileProgress(e.payload.hash, e.payload.progress);
      }
    ).then((u) => unlisten.push(u));

    return () => unlisten.forEach((u) => u());
  }, [setSyncing, setFileProgress]);
}
