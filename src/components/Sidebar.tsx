import { NavLink } from "react-router-dom";
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
          "flex items-center gap-3 rounded-md py-2 pr-3 text-sm font-medium transition-all duration-150",
          isActive
            ? "pl-[10px] text-[var(--gold)]"
            : "pl-3 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
        )
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: "var(--gold-glow)",
              borderLeft: "2px solid var(--gold)",
            }
          : { borderLeft: "2px solid transparent" }
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.playlists.list(),
  });

  return (
    <aside
      className="flex shrink-0 flex-col py-4"
      style={{
        width: "var(--sidebar-w)",
        background: "var(--surface)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2.5 px-4">
        <span
          style={{
            fontFamily: "'Noto Sans Devanagari', serif",
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--gold)",
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          श्र
        </span>
        <div className="flex flex-col">
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "var(--text)",
              lineHeight: 1,
            }}
          >
            SRAVYA
          </span>
          <span
            style={{
              fontSize: "9px",
              color: "var(--text-subtle)",
              letterSpacing: "0.06em",
              lineHeight: 1.4,
            }}
          >
            श्रव्य
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4 h-px" style={{ background: "var(--border-subtle)" }} />

      {/* Playlists */}
      <div className="flex flex-1 flex-col overflow-hidden px-2">
        <div className="mb-2 flex items-center justify-between px-3">
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--text-subtle)",
            }}
          >
            PLAYLISTS
          </span>
          <NavLink
            to="/playlists"
            title="Manage playlists"
            className="rounded p-0.5 transition-colors"
            style={{ color: "var(--text-subtle)" }}
          >
            <Plus size={12} />
          </NavLink>
        </div>

        <div className="flex-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="px-3 py-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              No playlists yet
            </p>
          ) : (
            playlists.map((pl) => (
              <NavLink
                key={pl.id}
                to={`/playlists?id=${pl.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "text-[var(--gold)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                  )
                }
              >
                <ListMusic size={12} className="shrink-0" />
                <span className="truncate">{pl.name}</span>
              </NavLink>
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
