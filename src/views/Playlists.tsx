import { ListMusic } from "lucide-react";

export default function Playlists() {
  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-6 text-2xl font-bold">Playlists</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <ListMusic size={48} className="text-[var(--color-text-subtle)]" />
        <p className="text-[var(--color-text-muted)]">
          No playlists yet. Create one to get started.
        </p>
      </div>
    </div>
  );
}
