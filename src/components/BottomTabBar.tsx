import { NavLink } from "react-router-dom";
import { Library, Search, Wifi, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/library", icon: Library, label: "Library" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/sync", icon: Wifi, label: "Sync" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomTabBar() {
  return (
    <nav
      className="flex shrink-0 items-stretch"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-[var(--gold)]" : "text-[var(--text-muted)]"
            )
          }
          style={{ minHeight: 56 }}
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
