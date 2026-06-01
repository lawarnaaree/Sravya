import { NavLink } from 'react-router-dom'
import { Library, ListMusic, Search, Settings, Wifi } from 'lucide-react'

const NAV = [
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/playlists', icon: ListMusic, label: 'Playlists' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/sync', icon: Wifi, label: 'Sync' },
]

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '7px 10px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'background 0.15s ease, color 0.15s ease',
        background: isActive ? 'var(--accent-muted)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-2)',
        textDecoration: 'none',
      })}
      onMouseEnter={e => {
        const el = e.currentTarget
        if (!el.getAttribute('aria-current')) {
          el.style.background = 'rgba(0,0,0,0.05)'
          el.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        if (!el.getAttribute('aria-current')) {
          el.style.background = 'transparent'
          el.style.color = 'var(--text-2)'
        }
      }}
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside
      style={{
        width: '220px',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'var(--shadow-sidebar)',
      }}
    >
      {/* App identity */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <img
            src="/logo.png"
            alt="Sravya"
            style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'cover' }}
          />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            Sravya
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Settings at bottom */}
      <div style={{ padding: '8px 8px 12px' }}>
        <div style={{ height: '1px', background: 'var(--separator)', margin: '0 4px 8px' }} />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </div>
    </aside>
  )
}
