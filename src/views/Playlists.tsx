import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, ListMusic } from 'lucide-react'
import { api } from '@/api'
import { TrackList } from '@/components/TrackList'

export function Playlists() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const queryClient = useQueryClient()

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: api.playlists.list,
  })

  const { data: tracks = [] } = useQuery({
    queryKey: ['playlist-tracks', selectedId],
    queryFn: () => api.playlists.tracks(selectedId!),
    enabled: !!selectedId,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.playlists.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setCreateOpen(false)
      setNewName('')
    },
  })

  const selected = playlists.find(p => p.id === selectedId)

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div
        className="w-[220px] shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--separator)' }}
      >
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            Playlists
          </h2>
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger asChild>
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--border)', color: 'var(--text-2)' }}
              >
                <Plus size={14} />
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'var(--overlay)' }} />
              <Dialog.Content
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 p-6 rounded-2xl"
                style={{ background: 'var(--surface-raised)', boxShadow: 'var(--shadow-modal)' }}
              >
                <Dialog.Title className="text-[17px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
                  New Playlist
                </Dialog.Title>

                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Playlist name"
                  className="w-full px-3 py-2 rounded-xl text-[14px] outline-none mb-4"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) {
                      createMutation.mutate(newName.trim())
                    }
                  }}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => createMutation.mutate(newName.trim())}
                    disabled={!newName.trim()}
                    className="flex-1 py-2 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    Create
                  </button>
                  <Dialog.Close asChild>
                    <button
                      className="flex-1 py-2 rounded-xl text-[14px] font-medium"
                      style={{ background: 'var(--border)', color: 'var(--text)' }}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>

        <div className="flex-1 overflow-auto px-2 pb-4 space-y-0.5">
          {playlists.length === 0 ? (
            <p className="text-center text-[12px] mt-8" style={{ color: 'var(--text-3)' }}>
              No playlists yet
            </p>
          ) : (
            playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => setSearchParams({ id: pl.id })}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left transition-colors"
                style={{
                  background: selectedId === pl.id ? 'var(--accent-muted)' : 'transparent',
                  color: selectedId === pl.id ? 'var(--accent)' : 'var(--text)',
                }}
              >
                <ListMusic size={14} className="shrink-0" />
                <span className="text-[13px] truncate">{pl.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-6 pt-6 pb-4 shrink-0">
              <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text)' }}>
                {selected.name}
              </h1>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-2)' }}>
                {tracks.length} tracks
              </p>
            </div>
            <TrackList tracks={tracks} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              Select a playlist
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
