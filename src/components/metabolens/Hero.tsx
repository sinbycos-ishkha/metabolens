import { ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

export function Hero({ participants }: { participants: number | null }) {
  return (
    <section id="top" className="hero-glow relative overflow-hidden">
      <div className="grid-lines pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
        <div className="max-w-3xl">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Rule-based metabolic screening on{" "}
            {participants ? participants.toLocaleString() : "a real"} cohort records
          </span>
          <h1 className="animate-rise mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl" style={{ animationDelay: "80ms" }}>
            Metabolic Risk, <span className="text-gradient">Made Understandable.</span>
          </h1>
          <p
            className="animate-rise mt-5 max-w-xl text-lg text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            Explore metabolic health patterns across the population — then see where your own measurements
            stand.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <a
              href="#population"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
            >
              Explore Population
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#assessment"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
            >
              Assess My Risk
            </a>
          </div>
          <p
            className="animate-rise mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
            style={{ animationDelay: "320ms" }}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-moderate" />
            Educational screening tool — not a medical diagnosis.
          </p>
        </div>
      </div>
    </section>
  );
}
