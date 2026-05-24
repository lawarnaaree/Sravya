import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useDownloadQueueStore } from "@/state/downloadQueue";
import { useLanSyncStore } from "@/state/lanSync";
import { usePlatform } from "@/hooks/usePlatform";
import { api } from "@/api";

export default function DownloadToast() {
  const { pendingUrl, toastMessage, jobs, setPendingUrl, clearToast, setToastMessage } =
    useDownloadQueueStore();
  const platform = usePlatform();
  const isPaired = useLanSyncStore((s) => s.isPaired);

  const activeJob = jobs.find((j) => j.state === "downloading" || j.state === "processing");

  // Auto-dismiss completion/error toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const id = setTimeout(clearToast, 4000);
    return () => clearTimeout(id);
  }, [toastMessage, clearToast]);

  const handleDownload = async () => {
    if (!pendingUrl) return;
    const url = pendingUrl;
    setPendingUrl(null);

    if (platform === "ios") {
      if (!isPaired) {
        setToastMessage("Pair with desktop in Sync tab to download YouTube links.");
        return;
      }
      try {
        await api.lan.importUrl(url);
        setToastMessage("Downloading on desktop — will sync to your phone when ready.");
      } catch (e) {
        console.error("import_url_remote failed:", e);
        setToastMessage(`Cannot send to desktop: ${e}`);
      }
      return;
    }

    try {
      const result = await api.import.url(url);
      if (result.status === "refused") {
        setToastMessage(`Cannot download: ${result.reason}`);
      }
    } catch (e) {
      console.error("import_url failed:", e);
    }
  };

  const handleDismiss = () => setPendingUrl(null);

  const buttonLabel = platform === "ios" ? "Send to desktop" : "Download as MP3";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "5.5rem",
        right: "1.25rem",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        alignItems: "flex-end",
      }}
    >
      <AnimatePresence mode="popLayout">
        {/* Active download progress row */}
        {activeJob && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "0.6rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              minWidth: "240px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <Loader2
              size={13}
              className="animate-spin"
              style={{ color: "var(--gold)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeJob.title ?? "Downloading…"}
              </p>
              <div
                style={{
                  height: "3px",
                  background: "var(--overlay, rgba(255,255,255,0.1))",
                  borderRadius: "9999px",
                  marginTop: "4px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(activeJob.progress * 100)}%`,
                    background: "var(--gold)",
                    borderRadius: "9999px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
            <span
              style={{ fontSize: "0.6875rem", color: "var(--text-muted, #888)", flexShrink: 0 }}
            >
              {Math.round(activeJob.progress * 100)}%
            </span>
          </motion.div>
        )}

        {/* YouTube URL detection prompt */}
        {pendingUrl && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minWidth: "260px",
              maxWidth: "320px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Download size={13} style={{ color: "var(--gold)", flexShrink: 0 }} />
              <span
                style={{ fontSize: "0.8125rem", color: "var(--text)", flex: 1, fontWeight: 500 }}
              >
                YouTube link detected
              </span>
              <button
                onClick={handleDismiss}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--text-muted, #888)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={13} />
              </button>
            </div>
            <p
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted, #888)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pendingUrl}
            </p>
            <button
              onClick={handleDownload}
              style={{
                background: "var(--gold)",
                color: "#000",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.375rem 0.875rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              {buttonLabel}
            </button>
          </motion.div>
        )}

        {/* Completion / error toast */}
        {!pendingUrl && toastMessage && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "0.6rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              maxWidth: "300px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {toastMessage.startsWith("Download failed") ||
            toastMessage.startsWith("Cannot download") ? (
              <AlertTriangle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
            ) : (
              <Check size={13} style={{ color: "#22c55e", flexShrink: 0 }} />
            )}
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {toastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
