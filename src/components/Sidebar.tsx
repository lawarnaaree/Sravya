import { NavLink } from "react-router-dom";
import { Library, Search, ListMusic, Settings, Music } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/library", icon: Library, label: "Library" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/playlists", icon: ListMusic, label: "Playlists" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 px-2">
        <Music size={20} className="text-[var(--color-accent)]" />
        <span className="text-base font-semibold tracking-wide">Sravya</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Playlists section */}
      <div className="mt-6 flex-1 overflow-y-auto">
        <p className="mb-2 px-3 text-xs font-medium tracking-wider text-[var(--color-text-subtle)] uppercase">
          Playlists
        </p>
        <p className="px-3 text-xs text-[var(--color-text-subtle)]">No playlists yet</p>
      </div>

      {/* Settings */}
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive
              ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
          )
        }
      >
        <Settings size={16} />
        Settings
      </NavLink>
    </aside>
  );
}
