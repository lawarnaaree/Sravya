import { Music2 } from "lucide-react";

export default function Library() {
  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-6 text-2xl font-bold">Library</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Music2 size={48} className="text-[var(--color-text-subtle)]" />
        <p className="text-[var(--color-text-muted)]">
          Your library is empty.
          <br />
          Add a folder in Settings to get started.
        </p>
      </div>
    </div>
  );
}
