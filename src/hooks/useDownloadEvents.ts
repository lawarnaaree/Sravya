import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useDownloadQueueStore } from "@/state/downloadQueue";
import type { DownloadJob } from "@/api";

export function useDownloadEvents() {
  const upsertJob = useDownloadQueueStore((s) => s.upsertJob);
  const setToastMessage = useDownloadQueueStore((s) => s.setToastMessage);
  const queryClient = useQueryClient();

  useEffect(() => {
    const p1 = listen<DownloadJob>("download-progress", ({ payload }) => {
      upsertJob(payload);
    });

    const p2 = listen<DownloadJob>("download-complete", ({ payload }) => {
      upsertJob(payload);
      setToastMessage(`"${payload.title ?? "Track"}" added to library`);
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["artists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    });

    const p3 = listen<DownloadJob>("download-failed", ({ payload }) => {
      upsertJob(payload);
      const state = payload.state;
      const err =
        typeof state === "object" && "failed" in state ? state.failed.error : "Unknown error";
      setToastMessage(`Download failed: ${err}`);
    });

    return () => {
      p1.then((f) => f());
      p2.then((f) => f());
      p3.then((f) => f());
    };
  }, [upsertJob, setToastMessage, queryClient]);
}
