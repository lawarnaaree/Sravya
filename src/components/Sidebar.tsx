import { NavLink, Link, useLocation } from "react-router-dom";
import { Library, Search, Settings, ListMusic, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/api";

const mainNav = [
  { to: "/library", icon: Library, label: "Library" },
  { to: "/search", icon: Search, label: "Search" },
];

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md py-2.5 pr-3 text-sm font-semibold",
          isActive
            ? "pl-[10px] text-[var(--text)]"
            : "pl-3 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
        )
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: "var(--surface-raised)",
            }
          : { borderLeft: "2px solid transparent" }
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const activePlaylistId = new URLSearchParams(location.search).get("id");

  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.playlists.list(),
  });

  return (
    <aside
      className="flex shrink-0 flex-col py-4"
      style={{
        width: "var(--sidebar-w)",
        background: "var(--sidebar-bg)",
      }}
    >
      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4 h-px" style={{ background: "var(--border-subtle)" }} />

      {/* Your Library */}
      <div className="flex flex-1 flex-col overflow-hidden px-2">
        <div className="mb-2 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <ListMusic size={18} style={{ color: "var(--text-subtle)" }} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--text-subtle)",
              }}
            >
              Your Library
            </span>
          </div>
          <NavLink
            to="/playlists?create=true"
            title="New playlist"
            className="rounded p-0.5 transition-colors hover:text-[var(--text)]"
            style={{ color: "var(--text-subtle)" }}
          >
            <Plus size={14} />
          </NavLink>
        </div>

        <div className="flex-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="px-3 py-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              No playlists yet
            </p>
          ) : (
            playlists.map((pl) => (
              <Link
                key={pl.id}
                to={`/playlists?id=${pl.id}`}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                  activePlaylistId === String(pl.id)
                    ? "bg-[var(--surface-raised)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                )}
              >
                <span className="truncate">{pl.name}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="mt-2 px-2">
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </div>
    </aside>
  );
}
