import { Activity } from "lucide-react";

const links = [
  { href: "#population", label: "Population Dashboard" },
  { href: "#assessment", label: "Personal Assessment" },
  { href: "#methodology", label: "Methodology" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Activity className="h-4.5 w-4.5 text-primary" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-semibold tracking-tight">MetaboLens</span>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              See the population. Understand your risk.
            </span>
          </span>
        </a>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2/70 hover:text-foreground md:block"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#assessment"
            className="ml-1 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Assess My Risk
          </a>
        </nav>
      </div>
    </header>
  );
}
