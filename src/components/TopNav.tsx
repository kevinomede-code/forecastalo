import { Link } from "@tanstack/react-router";

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-medium";

export default function TopNav({ tagline }: { tagline: string }) {
  return (
    <header className="flex shrink-0 items-baseline gap-4 border-b border-border bg-card px-6 py-3">
      <span className="text-base font-semibold tracking-tight">Forecastalo</span>
      <span className="hidden truncate text-sm text-muted-foreground sm:inline">{tagline}</span>
      <nav className="ml-auto flex shrink-0 items-baseline gap-4">
        <Link to="/" className={linkClass}>
          Screening
        </Link>
        <Link to="/graph" className={linkClass}>
          Knowledge
        </Link>
      </nav>
    </header>
  );
}
