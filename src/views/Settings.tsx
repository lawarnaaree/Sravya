export default function Settings() {
  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <div className="flex max-w-lg flex-col gap-6">
        <section>
          <h2 className="mb-3 text-base font-semibold">Music Library</h2>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">
              Add folders to watch for music files.
            </p>
            <button className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]">
              Add Folder
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Audio</h2>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Bit-perfect output, ReplayGain, EQ — Phase 2.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Connected Accounts</h2>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Spotify, YouTube, Apple Music metadata sync — Phase 5.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
