import { it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { NowPlayingBar } from '@/components/NowPlayingBar'
import { usePlayerStore } from '@/state/player'
import { renderWithProviders } from '../helpers'
import type { Track } from '@/api'

const mockTrack: Track = {
  id: 'track-1',
  title: 'Midnight Raga',
  artist: 'Hariprasad Chaurasia',
  album: 'Ragas at Dawn',
  file_hash: 'abc',
  file_ext: 'flac',
  file_path: '/music/midnight.flac',
  duration_ms: 240000,
  added_at: '2024-01-01T00:00:00Z',
}

it('renders "Nothing playing" when no track', () => {
  usePlayerStore.setState({ currentTrack: null })
  renderWithProviders(<NowPlayingBar />)
  expect(screen.getByText(/nothing playing/i)).toBeInTheDocument()
})

it('renders track title and artist', () => {
  usePlayerStore.setState({ currentTrack: mockTrack, isPlaying: false })
  renderWithProviders(<NowPlayingBar />)
  expect(screen.getByText('Midnight Raga')).toBeInTheDocument()
  expect(screen.getByText('Hariprasad Chaurasia')).toBeInTheDocument()
})

it('shows play button when paused', () => {
  usePlayerStore.setState({ currentTrack: mockTrack, isPlaying: false })
  renderWithProviders(<NowPlayingBar />)
  expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
})

it('shows pause button when playing', () => {
  usePlayerStore.setState({ currentTrack: mockTrack, isPlaying: true })
  renderWithProviders(<NowPlayingBar />)
  expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
})
