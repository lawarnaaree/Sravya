import { NavLink } from 'react-router-dom'
import { Library, Search, Settings, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/sync', icon: Wifi, label: 'Sync' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomTabBar() {
  return (
    <nav
      className="glass-player flex justify-around items-center h-[60px] border-t shrink-0 px-2"
      style={{ borderColor: 'var(--separator)' }}
    >
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors',
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
            )
          }
        >
          <Icon size={20} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
