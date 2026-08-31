import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/metabolic";

/* Tier → semantic token classes (no raw colors in components). */
export const tierStyle: Record<RiskTier, { text: string; bg: string; ring: string; dot: string }> = {
  "Low Risk": { text: "text-low", bg: "bg-low/12", ring: "ring-low/40", dot: "bg-low" },
  "Moderate Risk": { text: "text-moderate", bg: "bg-moderate/12", ring: "ring-moderate/40", dot: "bg-moderate" },
  "High Risk": { text: "text-high", bg: "bg-high/14", ring: "ring-high/40", dot: "bg-high" },
};

export const TIER_ORDER: RiskTier[] = ["Low Risk", "Moderate Risk", "High Risk"];

/** Reveals children with a subtle rise animation once scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className, shown && "animate-rise")}
      style={{ opacity: shown ? undefined : 0, animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Animated number counter used by the KPI cards. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 1100,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span>
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  hint,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  accent?: RiskTier;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="glass group relative overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1">
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-px opacity-70",
            accent ? tierStyle[accent].dot : "bg-primary",
          )}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-3 font-display text-3xl font-semibold tabular-nums",
            accent ? tierStyle[accent].text : "text-foreground",
          )}
        >
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </Reveal>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function ChartCard({
  title,
  caption,
  insight,
  children,
  className,
}: {
  title: string;
  caption?: string;
  insight?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass flex flex-col rounded-2xl p-5", className)}>
      <div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {insight ? (
        <p className="mt-4 rounded-xl border border-border/60 bg-surface-2/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-primary">Insight — </span>
          {insight}
        </p>
      ) : null}
    </div>
  );
}
