import { Link } from "@tanstack/react-router";
import { ScanLine, ListChecks, Users, Settings as Cog } from "lucide-react";

const items = [
  { to: "/", label: "Scan", icon: ScanLine },
  { to: "/session", label: "Session", icon: ListChecks },
  { to: "/roster", label: "Roster", icon: Users },
  { to: "/settings", label: "Settings", icon: Cog },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
