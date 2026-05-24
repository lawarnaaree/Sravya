import { useEffect, useRef } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useDownloadQueueStore } from "@/state/downloadQueue";
import { usePlatform } from "@/hooks/usePlatform";

const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/;

const POLL_MS = 1500;

export function useClipboardMonitor() {
  const lastSeen = useRef<string | null>(null);
  const setPendingUrl = useDownloadQueueStore((s) => s.setPendingUrl);
  const pendingUrl = useDownloadQueueStore((s) => s.pendingUrl);
  const platform = usePlatform();

  useEffect(() => {
    let active = true;

    async function check() {
      if (!active) return;
      try {
        const text = await readText();
        if (text && text !== lastSeen.current && !pendingUrl && YOUTUBE_RE.test(text.trim())) {
          lastSeen.current = text.trim();
          setPendingUrl(text.trim());
        }
      } catch {
        // Clipboard empty or permission denied — ignore silently
      }
    }

    if (platform === "ios") {
      // iOS shows a clipboard-read banner on every read — polling is hostile.
      // Check once on mount, then only when the app returns to the foreground.
      void check();
      const onVisible = () => {
        if (document.visibilityState === "visible") void check();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        active = false;
        document.removeEventListener("visibilitychange", onVisible);
      };
    }

    // Desktop: poll continuously, no system prompt.
    const id = setInterval(check, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setPendingUrl, pendingUrl, platform]);
}
