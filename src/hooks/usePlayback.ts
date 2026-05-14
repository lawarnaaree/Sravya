import { useEffect } from "react";
import { api } from "@/api";
import { usePlayerStore } from "@/state/player";

export function usePlaybackPoller() {
  const setStatus = usePlayerStore((s) => s.setStatus);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const status = await api.playback.status();
        if (active) setStatus(status);
      } catch {
        // ignore until backend is ready
      }
    }

    poll();
    const id = setInterval(poll, 500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setStatus]);
}
