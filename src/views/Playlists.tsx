import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Music2, X } from "lucide-react";
import { api } from "@/api";
import { formatDuration } from "@/lib/utils";
import TrackList from "@/components/TrackList";

function CreateDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => api.playlists.create(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      onClose();
    },
  });

  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className="animate-fade-in fixed inset-0 z-40"
        style={{ background: "rgba(9,9,15,0.7)" }}
      />
      <Dialog.Content
        className="animate-slide-up fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 shadow-2xl"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <Dialog.Title className="text-base font-semibold" style={{ color: "var(--text)" }}>
            New Playlist
          </Dialog.Title>
          <Dialog.Close
            className="rounded p-1 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </Dialog.Close>
        </div>

        <input
          autoFocus
          type="text"
          placeholder="Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) create.mutate();
          }}
          className="mb-4 w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="flex justify-end gap-2">
          <Dialog.Close
            className="rounded-lg px-4 py-2 text-sm transition-colors"
            style={{
              background: "var(--overlay)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </Dialog.Close>
          <button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              background: "var(--gold)",
              color: "var(--text-on-gold)",
            }}
          >
            Create
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export default function Playlists() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedId = searchParams.get("id");
  const createOpen = searchParams.get("create") === "true";

  function handleCreateOpenChange(open: boolean) {
    if (!open) {
      navigate(selectedId ? `/playlists?id=${selectedId}` : "/playlists", { replace: true });
    }
  }

  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.playlists.list(),
  });

  const { data: playlistTracks = [] } = useQuery({
    queryKey: ["playlist-tracks", selectedId],
    queryFn: () => api.library.playlistTracks(selectedId!),
    enabled: !!selectedId,
  });

  const selectedPlaylist = playlists.find((p) => p.id === selectedId);

  return (
    <div className="flex h-full flex-col">
      <Dialog.Root open={createOpen} onOpenChange={handleCreateOpenChange}>
        <CreateDialog onClose={() => handleCreateOpenChange(false)} />
      </Dialog.Root>

      {selectedPlaylist ? (
        <>
          <div
            className="shrink-0 px-6 py-4"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              {selectedPlaylist.name}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-subtle)" }}>
              {selectedPlaylist.trackCount} tracks ·{" "}
              {formatDuration(selectedPlaylist.totalDurationMs)}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TrackList tracks={playlistTracks} showAlbum />
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Music2 size={40} style={{ color: "var(--text-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Select a playlist to view its tracks
          </p>
        </div>
      )}
    </div>
  );
}
