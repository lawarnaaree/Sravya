import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { convertFileSrc } from '@tauri-apps/api/core'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`
}

export function coverUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return convertFileSrc(path)
}
