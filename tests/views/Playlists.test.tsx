import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import { Playlists } from '@/views/Playlists'
import { renderWithProviders } from '../helpers'

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  if (cmd === 'get_playlists') return [{ id: 'p1', name: 'My Playlist', created_at: '2024-01-01', updated_at: '2024-01-01' }]
  if (cmd === 'get_playlist_tracks') return []
  return null
})

describe('Playlists', () => {
  it('renders playlist list', async () => {
    renderWithProviders(<Playlists />)
    await waitFor(() => {
      expect(screen.getByText('My Playlist')).toBeInTheDocument()
    })
  })

  it('shows create button', () => {
    renderWithProviders(<Playlists />)
    expect(screen.getByText('Playlists')).toBeInTheDocument()
  })

  it('opens create dialog on + click', async () => {
    renderWithProviders(<Playlists />)
    const btn = screen.getByRole('button', { name: '' })
    await userEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText('New Playlist')).toBeInTheDocument()
    })
  })
})
