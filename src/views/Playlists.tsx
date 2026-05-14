import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { ListMusic, Plus, Trash2, X, Music2 } from "lucide-react";
import { api } from "@/api";
import type { Playlist } from "@/api";
import { cn, formatDuration } from "@/lib/utils";
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

function PlaylistRow({
  playlist,
  isSelected,
  onSelect,
  onDelete,
}: {
  playlist: Playlist;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
      )}
      style={{
        background: isSelected ? "var(--gold-glow)" : undefined,
        borderLeft: isSelected ? "2px solid var(--gold)" : "2px solid transparent",
        paddingLeft: isSelected ? "10px" : "12px",
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.background = "var(--surface-raised)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = "";
      }}
    >
      <ListMusic
        size={14}
        className="shrink-0"
        style={{ color: isSelected ? "var(--gold)" : "var(--text-subtle)" }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: isSelected ? "var(--gold)" : "var(--text)" }}
        >
          {playlist.name}
        </p>
        <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {playlist.trackCount} tracks
        </p>
      </div>
      <button
        className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--text-subtle)" }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${playlist.name}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function Playlists() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const selectedId = searchParams.get("id");

  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.playlists.list(),
  });

  const { data: playlistTracks = [] } = useQuery({
    queryKey: ["playlist-tracks", selectedId],
    queryFn: () => api.library.playlistTracks(selectedId!),
    enabled: !!selectedId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.playlists.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      if (selectedId === deletedId) {
        setSearchParams({});
      }
    },
  });

  const selectedPlaylist = playlists.find((p) => p.id === selectedId);

  return (
    <div className="flex h-full">
      {/* Left panel — playlist list */}
      <div
        className="flex w-60 shrink-0 flex-col"
        style={{ borderRight: "1px solid var(--border-subtle)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Playlists
          </h2>
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger asChild>
              <button
                className="rounded p-1 transition-colors"
                style={{ color: "var(--text-muted)" }}
                title="New playlist"
              >
                <Plus size={16} />
              </button>
            </Dialog.Trigger>
            <CreateDialog onClose={() => setCreateOpen(false)} />
          </Dialog.Root>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <ListMusic size={28} style={{ color: "var(--text-subtle)" }} />
              <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No playlists yet.
                <br />
                Click + to create one.
              </p>
            </div>
          ) : (
            playlists.map((pl) => (
              <PlaylistRow
                key={pl.id}
                playlist={pl}
                isSelected={pl.id === selectedId}
                onSelect={() => setSearchParams({ id: pl.id })}
                onDelete={() => deleteMutation.mutate(pl.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — tracks */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
    </div>
  );
}
