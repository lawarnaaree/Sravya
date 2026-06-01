import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn().mockResolvedValue('windows'),
}))

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn().mockResolvedValue(''),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_t: unknown, prop: string) =>
        ({ children, ...rest }: { children?: React.ReactNode; [k: string]: unknown }) => {
          const Tag = prop as React.ElementType
          const safeProps = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'variants'].includes(k)),
          )
          return <Tag {...safeProps}>{children}</Tag>
        },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
