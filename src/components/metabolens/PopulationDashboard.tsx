import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { histogram, mean, median, THRESHOLDS, type Cohort, type RiskTier } from "@/lib/metabolic";
import { ChartCard, KpiCard, Reveal, SectionHeading, TIER_ORDER, tierStyle } from "./ui";

const TIER_VAR: Record<RiskTier, string> = {
  "Low Risk": "var(--low)",
  "Moderate Risk": "var(--moderate)",
  "High Risk": "var(--high)",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">{payload[0]?.payload?.tooltipLabel ?? label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function PopulationDashboard({ cohort }: { cohort: Cohort }) {
  const [filter, setFilter] = useState<"All" | RiskTier>("All");

  const all = cohort.participants;
  const view = useMemo(() => (filter === "All" ? all : all.filter((p) => p.tier === filter)), [all, filter]);

  const tierCounts = useMemo(
    () =>
      TIER_ORDER.map((tier) => {
        const rows = all.filter((p) => p.tier === tier);
        return {
          tier,
          name: tier,
          count: rows.length,
          pct: all.length ? (rows.length / all.length) * 100 : 0,
          avgAge: mean(rows.map((p) => p.age)),
          tooltipLabel: tier,
        };
      }),
    [all],
  );

  const dominant = tierCounts.reduce((a, b) => (b.count > a.count ? b : a), tierCounts[0]!);

  const bmiBins = useMemo(() => histogram(view.map((p) => p.bmi), 22, 1), [view]);
  const glucoseBins = useMemo(() => histogram(view.map((p) => p.glucose), 24, 0), [view]);

  const viewBmiMedian = median(view.map((p) => p.bmi));
  const viewGlucoseMedian = median(view.map((p) => p.glucose));
  const highGlucoseShare = view.length
    ? (view.filter((p) => p.glucose >= THRESHOLDS.moderate.glucose).length / view.length) * 100
    : 0;

  const pct = (tier: RiskTier) => tierCounts.find((t) => t.tier === tier)?.pct ?? 0;

  const bmiData = bmiBins.map((b) => ({ ...b, tooltipLabel: `BMI ${b.range}` }));
  const glucoseData = glucoseBins.map((b) => ({ ...b, tooltipLabel: `${b.range} mg/dL` }));

  return (
    <section id="population" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Population Overview"
          title="How does metabolic risk vary across the cohort?"
          subtitle="Every figure below is computed live from the dataset — no hardcoded statistics."
        />
        <Reveal>
          <div className="glass flex items-center gap-1 rounded-xl p-1">
            {(["All", ...TIER_ORDER] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  filter === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Participants" value={view.length} hint={filter === "All" ? "Analysed rows" : `${filter} only`} />
        <KpiCard label="Low Risk" value={pct("Low Risk")} decimals={1} suffix="%" accent="Low Risk" delay={60} />
        <KpiCard
          label="Moderate Risk"
          value={pct("Moderate Risk")}
          decimals={1}
          suffix="%"
          accent="Moderate Risk"
          delay={120}
        />
        <KpiCard label="High Risk" value={pct("High Risk")} decimals={1} suffix="%" accent="High Risk" delay={180} />
        <KpiCard label="Average BMI" value={mean(view.map((p) => p.bmi))} decimals={1} delay={240} />
        <KpiCard label="Average Age" value={mean(view.map((p) => p.age))} decimals={1} suffix=" yrs" delay={300} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <ChartCard
            title="Risk distribution"
            caption="Mutually exclusive tiers — High Risk rules are applied first."
            insight={`${dominant.pct.toFixed(1)}% of participants (${dominant.count.toLocaleString()}) fall within the ${dominant.tier} tier, the largest group in this cohort.`}
            className="h-full"
          >
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierCounts}
                      dataKey="count"
                      nameKey="tier"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={3}
                      stroke="none"
                      animationDuration={900}
                    >
                      {tierCounts.map((t) => (
                        <Cell key={t.tier} fill={TIER_VAR[t.tier]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-3">
                {tierCounts.map((t) => (
                  <li key={t.tier} className="flex items-center gap-3">
                    <span className={cn("h-2.5 w-2.5 rounded-full", tierStyle[t.tier].dot)} />
                    <span className="text-sm text-muted-foreground">{t.tier}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {t.count.toLocaleString()}{" "}
                      <span className={cn("text-xs", tierStyle[t.tier].text)}>({t.pct.toFixed(1)}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartCard>
        </Reveal>

        <Reveal delay={80}>
          <ChartCard
            title="Average age by risk tier"
            caption="Hover a bar for the exact cohort average."
            insight={`Average age rises from ${(tierCounts[0]?.avgAge ?? 0).toFixed(1)} years in Low Risk to ${(tierCounts[2]?.avgAge ?? 0).toFixed(1)} years in High Risk.`}
            className="h-full"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierCounts.map((t) => ({ ...t, avgAge: Number(t.avgAge.toFixed(1)) }))}>
                  <XAxis dataKey="tier" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    label={{
                      value: "Average age (years)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "var(--muted-foreground)", fontSize: 11 },
                    }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.4 }} />
                  <Bar dataKey="avgAge" name="Average age" radius={[8, 8, 0, 0]} animationDuration={900}>
                    {tierCounts.map((t) => (
                      <Cell key={t.tier} fill={TIER_VAR[t.tier]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </Reveal>

        <Reveal delay={120}>
          <ChartCard
            title="BMI distribution"
            caption="Equal-width bins, kg/m². Dashed line marks the median."
            insight={`The cohort's median BMI is ${viewBmiMedian.toFixed(1)} kg/m².`}
            className="h-full"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bmiData}>
                  <XAxis
                    dataKey="label"
                    interval={3}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    label={{
                      value: "BMI (kg/m²)",
                      position: "insideBottom",
                      offset: -4,
                      style: { fill: "var(--muted-foreground)", fontSize: 11 },
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.4 }} />
                  <ReferenceLine
                    x={bmiData.reduce((best, b) =>
                      Math.abs(b.center - viewBmiMedian) < Math.abs(best.center - viewBmiMedian) ? b : best,
                    bmiData[0]!).label}
                    stroke="var(--primary)"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="count" name="Participants" fill="var(--primary)" radius={[4, 4, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </Reveal>

        <Reveal delay={160}>
          <ChartCard
            title="Blood glucose distribution"
            caption="mg/dL. Amber line = 100 (moderate rule), red line = 140 (high rule). Thresholds are screening rules, not diagnoses."
            insight={`Median glucose is ${viewGlucoseMedian.toFixed(1)} mg/dL, and ${highGlucoseShare.toFixed(1)}% of this view sits at or above the 100 mg/dL rule threshold.`}
            className="h-full"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={glucoseData}>
                  <XAxis
                    dataKey="label"
                    interval={3}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    label={{
                      value: "Blood glucose (mg/dL)",
                      position: "insideBottom",
                      offset: -4,
                      style: { fill: "var(--muted-foreground)", fontSize: 11 },
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.4 }} />
                  {[THRESHOLDS.moderate.glucose, THRESHOLDS.high.glucose].map((thr, i) => {
                    const nearest = glucoseData.reduce(
                      (best, b) => (Math.abs(b.center - thr) < Math.abs(best.center - thr) ? b : best),
                      glucoseData[0]!,
                    );
                    return (
                      <ReferenceLine
                        key={thr}
                        x={nearest.label}
                        stroke={i === 0 ? "var(--moderate)" : "var(--high)"}
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                  <Bar dataKey="count" name="Participants" fill="var(--accent)" radius={[4, 4, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </Reveal>
      </div>
    </section>
  );
}
