import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bmiCategory,
  calculateBmi,
  calculatePercentile,
  calculateRiskTier,
  generateRiskExplanation,
  generateSuggestions,
  type Cohort,
  type PersonalInput,
  type RiskTier,
} from "@/lib/metabolic";
import { CountUp, Reveal, SectionHeading, TIER_ORDER, tierStyle } from "./ui";

interface FormState {
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  waistCm: string;
  glucose: string;
  hba1c: string;
}

const EMPTY: FormState = {
  age: "",
  gender: "Female",
  heightCm: "",
  weightKg: "",
  waistCm: "",
  glucose: "",
  hba1c: "",
};

interface Result {
  bmi: number;
  tier: RiskTier;
  input: PersonalInput;
  bmiPct: number;
  glucosePct: number | null;
  hba1cPct: number | null;
  missing: string[];
}

function parseOptional(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null; // blank stays null — never coerced to 0
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  unit,
  optional,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  unit?: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        {unit ? <span className="normal-case tracking-normal text-muted-foreground/70">({unit})</span> : null}
        {optional ? (
          <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-primary">
            Optional
          </span>
        ) : null}
      </span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-2 w-full rounded-xl border bg-surface-2/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/30",
          error ? "border-high" : "border-input",
        )}
      />
      {error ? (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-high">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </span>
      ) : null}
    </label>
  );
}

function RiskMeter({ tier }: { tier: RiskTier }) {
  return (
    <div className="flex items-stretch gap-2">
      {TIER_ORDER.map((t, i) => {
        const active = t === tier;
        return (
          <div
            key={t}
            className={cn(
              "flex-1 rounded-xl border px-3 py-3 text-center transition-all duration-500",
              active
                ? cn(tierStyle[t].bg, tierStyle[t].text, "border-transparent ring-2", tierStyle[t].ring, "animate-pop")
                : "border-border/60 bg-surface-2/40 text-muted-foreground",
            )}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">{t.replace(" Risk", "")}</p>
            {active ? <p className="mt-1 text-[10px] uppercase tracking-[0.16em]">Your tier</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function CompareCard({
  metric,
  unit,
  value,
  cohortMedian,
  percentile,
  decimals = 1,
}: {
  metric: string;
  unit: string;
  value: number;
  cohortMedian: number;
  percentile: number;
  decimals?: number;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{metric}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {value.toFixed(decimals)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Cohort median: <span className="text-foreground">{cohortMedian.toFixed(decimals)}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.max(2, Math.min(100, percentile))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-primary">{Math.round(percentile)}th percentile in this dataset</p>
    </div>
  );
}

export function PersonalAssessment({ cohort }: { cohort: Cohort }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const set = (key: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  // Live BMI as soon as height + weight are valid
  const liveBmi = useMemo(() => {
    const h = parseOptional(form.heightCm);
    const w = parseOptional(form.weightKg);
    if (h === null || w === null) return null;
    return calculateBmi(w, h);
  }, [form.heightCm, form.weightKg]);

  function validate(): PersonalInput | null {
    const next: Partial<Record<keyof FormState, string>> = {};
    const age = parseOptional(form.age);
    const height = parseOptional(form.heightCm);
    const weight = parseOptional(form.weightKg);
    const waist = parseOptional(form.waistCm);
    const glucose = parseOptional(form.glucose);
    const hba1c = parseOptional(form.hba1c);

    if (age === null || age < 1 || age > 120) next.age = "Enter a realistic age between 1 and 120.";
    if (height === null || height <= 0 || height > 260) next.heightCm = "Height must be greater than 0 (up to 260 cm).";
    if (weight === null || weight <= 0 || weight > 400) next.weightKg = "Weight must be greater than 0 (up to 400 kg).";
    if (waist === null || waist <= 0 || waist > 250) next.waistCm = "Waist must be greater than 0 (up to 250 cm).";
    if (form.glucose.trim() && (glucose === null || glucose <= 0 || glucose > 800))
      next.glucose = "Enter a glucose value between 1 and 800 mg/dL, or leave blank.";
    if (form.hba1c.trim() && (hba1c === null || hba1c <= 0 || hba1c > 20))
      next.hba1c = "Enter an HbA1c between 1 and 20%, or leave blank.";

    setErrors(next);
    if (Object.keys(next).length) return null;

    return {
      age: age!,
      gender: form.gender,
      heightCm: height!,
      weightKg: weight!,
      waistCm: waist!,
      glucose,
      hba1c,
    };
  }

  function handleCalculate() {
    const input = validate();
    if (!input) return;
    const bmi = calculateBmi(input.weightKg, input.heightCm);
    if (bmi === null) return;

    // Same classifier as the cohort analysis — single source of truth.
    const tier = calculateRiskTier(input.hba1c, input.glucose, bmi);
    const missing: string[] = [];
    if (input.glucose === null) missing.push("Blood Glucose");
    if (input.hba1c === null) missing.push("HbA1c");

    setResult({
      bmi,
      tier,
      input,
      bmiPct: calculatePercentile(cohort.bmiValues, bmi),
      glucosePct: input.glucose === null ? null : calculatePercentile(cohort.glucoseValues, input.glucose),
      hba1cPct: input.hba1c === null ? null : calculatePercentile(cohort.hba1cValues, input.hba1c),
      missing,
    });
    setWhyOpen(false);
    requestAnimationFrame(() =>
      document.getElementById("your-result")?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  const explanation = result ? generateRiskExplanation(result.bmi, result.input.glucose, result.input.hba1c, result.tier) : [];
  const suggestions = result ? generateSuggestions(result.input, result.bmi, result.tier) : [];

  return (
    <section id="assessment" className="relative border-t border-border/60 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Your Metabolic Snapshot"
          title="Enter a few measurements to see how your profile compares with the cohort."
          subtitle="Blood Glucose and HbA1c are optional — leave them blank and we will tell you exactly what the assessment could not evaluate."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <Reveal>
            <div className="glass rounded-3xl p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Age" unit="years" value={form.age} onChange={set("age")} error={errors.age} placeholder="42" />
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Gender</span>
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender")(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-input bg-surface-2/60 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    {["Female", "Male", "Other / prefer not to say"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Height" unit="cm" value={form.heightCm} onChange={set("heightCm")} error={errors.heightCm} placeholder="172" />
                <Field label="Weight" unit="kg" value={form.weightKg} onChange={set("weightKg")} error={errors.weightKg} placeholder="81" />
                <Field label="Waist circumference" unit="cm" value={form.waistCm} onChange={set("waistCm")} error={errors.waistCm} placeholder="94" />
                <Field label="Blood glucose" unit="mg/dL" optional value={form.glucose} onChange={set("glucose")} error={errors.glucose} placeholder="105" />
                <Field label="HbA1c" unit="%" optional value={form.hba1c} onChange={set("hba1c")} error={errors.hba1c} placeholder="5.8" />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-surface-2/50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your BMI</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary">
                    {liveBmi ? liveBmi.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {liveBmi ? `${bmiCategory(liveBmi)} · context only, not the final tier` : "Enter height and weight"}
                  </p>
                </div>
                <button
                  onClick={handleCalculate}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
                >
                  <Sparkles className="h-4 w-4" />
                  Calculate My Risk
                </button>
              </div>
            </div>
          </Reveal>

          <div id="your-result">
            {!result ? (
              <div className="glass flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
                <Info className="h-6 w-6 text-primary" />
                <p className="font-display text-lg font-semibold">Your result appears here</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Fill in the form and select Calculate My Risk. Your tier follows the same rule-based model applied to
                  the whole cohort.
                </p>
              </div>
            ) : (
              <div className="animate-pop glass-strong rounded-3xl p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your result</p>
                <p className={cn("mt-2 font-display text-3xl font-semibold uppercase sm:text-4xl", tierStyle[result.tier].text)}>
                  {result.tier}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rule-based screening tier — educational, not a diagnosis.
                </p>

                <div className="mt-5">
                  <RiskMeter tier={result.tier} />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-surface-2/50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">BMI</p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                      <CountUp value={result.bmi} decimals={1} />
                    </p>
                    <p className="text-xs text-muted-foreground">{bmiCategory(result.bmi)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-surface-2/50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Population standing</p>
                    <p className="mt-1 text-sm text-foreground">
                      Your BMI is higher than{" "}
                      <span className="font-semibold text-primary">{Math.round(result.bmiPct)}%</span> of participants in
                      this cohort.
                    </p>
                    {result.glucosePct !== null ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your glucose is higher than {Math.round(result.glucosePct)}% of participants.
                      </p>
                    ) : null}
                    {result.hba1cPct !== null ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your HbA1c is higher than {Math.round(result.hba1cPct)}% of participants.
                      </p>
                    ) : null}
                  </div>
                </div>

                {result.missing.length ? (
                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-moderate/40 bg-moderate/10 px-3 py-2.5 text-xs text-moderate">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Assessment based on the measurements you provided. {result.missing.join(" and ")}{" "}
                      {result.missing.length > 1 ? "were" : "was"} not available, so{" "}
                      {result.missing.length > 1 ? "they" : "it"} could not be evaluated — adding{" "}
                      {result.missing.join(" or ")} gives a more complete assessment. No values were assumed.
                    </span>
                  </p>
                ) : null}

                <div className="mt-5">
                  <button
                    onClick={() => setWhyOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface-2/50 px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-2"
                  >
                    Why did I get this result?
                    <ChevronDown className={cn("h-4 w-4 transition-transform", whyOpen && "rotate-180")} />
                  </button>
                  {whyOpen ? (
                    <ul className="animate-rise mt-3 space-y-2 rounded-xl border border-border/60 bg-surface-2/40 p-4 text-sm">
                      {explanation.map((line, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 text-xs font-bold",
                              line.state === "trigger"
                                ? tierStyle[result.tier].text
                                : line.state === "clear"
                                  ? "text-low"
                                  : "text-muted-foreground",
                            )}
                          >
                            {line.state === "missing" ? "—" : "✓"}
                          </span>
                          <span className="text-muted-foreground">{line.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-6">
                  <h3 className="font-display text-base font-semibold">Personalized suggestions</h3>
                  <ul className="mt-3 space-y-2.5">
                    {suggestions.map((s, i) => (
                      <li
                        key={i}
                        className="animate-rise rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3 text-sm text-muted-foreground"
                        style={{ animationDelay: `${i * 90}ms` }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {result ? (
          <div className="mt-10">
            <h3 className="font-display text-xl font-semibold">You vs. the Cohort</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your standing relative to this dataset only — not a population-wide medical benchmark.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CompareCard
                metric="BMI"
                unit="kg/m²"
                value={result.bmi}
                cohortMedian={cohort.medians.bmi}
                percentile={result.bmiPct}
              />
              {result.input.glucose !== null && result.glucosePct !== null ? (
                <CompareCard
                  metric="Blood glucose"
                  unit="mg/dL"
                  value={result.input.glucose}
                  cohortMedian={cohort.medians.glucose}
                  percentile={result.glucosePct}
                />
              ) : null}
              {result.input.hba1c !== null && result.hba1cPct !== null ? (
                <CompareCard
                  metric="HbA1c"
                  unit="%"
                  value={result.input.hba1c}
                  cohortMedian={cohort.medians.hba1c}
                  percentile={result.hba1cPct}
                  decimals={2}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
