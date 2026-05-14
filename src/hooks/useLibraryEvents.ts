import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLibraryStore } from "@/state/library";
import { useQueryClient } from "@tanstack/react-query";

export function useLibraryEvents() {
  const setScanning = useLibraryStore((s) => s.setScanning);
  const queryClient = useQueryClient();

  useEffect(() => {
    const p1 = listen<{ scanned: number; total: number; added: number; skipped: number }>(
      "library-scan-progress",
      ({ payload }) => {
        const progress = payload.total > 0 ? payload.scanned / payload.total : 0;
        setScanning(true, progress);
      }
    );

    const p2 = listen("library-scan-complete", () => {
      setScanning(false, 1);
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["artists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    });

    return () => {
      p1.then((f) => f());
      p2.then((f) => f());
    };
  }, [setScanning, queryClient]);
}
