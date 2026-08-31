import { ShieldAlert } from "lucide-react";
import { THRESHOLDS, type Cohort } from "@/lib/metabolic";

export function Methodology({ cohort }: { cohort: Cohort }) {
  const r = cohort.report;
  return (
    <section id="methodology" className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">Methodology</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
            <h3 className="font-display text-sm font-semibold text-foreground">Dataset</h3>
            <p className="mt-2">
              <code className="text-primary">diabetes_risk_prediction_dataset-selected-columns.csv</code>, loaded
              read-only once per session and cached. {r.rowsInFile.toLocaleString()} rows read,{" "}
              {r.rowsAnalysed.toLocaleString()} analysed ({r.rowsDropped.toLocaleString()} excluded for implausible
              derived BMI). Column names are normalised through a mapping layer.
            </p>
          </div>
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
            <h3 className="font-display text-sm font-semibold text-foreground">Missing values</h3>
            <p className="mt-2">
              Median imputation for Height_cm, Weight_kg, Blood_Glucose and HbA1c. Zero or negative height/weight is
              treated as missing, never used in BMI.
            </p>
            <ul className="mt-2 space-y-1">
              {Object.entries(r.imputed).map(([k, v]) => (
                <li key={k}>
                  {k}: {v} imputed (median {(r.medians[k] ?? 0).toFixed(2)})
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
            <h3 className="font-display text-sm font-semibold text-foreground">BMI &amp; risk tiers</h3>
            <p className="mt-2">
              BMI = Weight_kg / (Height_cm / 100)². Tiers are evaluated in order, so they are mutually exclusive:
            </p>
            <ul className="mt-2 space-y-1">
              <li>
                <span className="text-high">High</span>: HbA1c ≥ {THRESHOLDS.high.hba1c} OR Glucose ≥{" "}
                {THRESHOLDS.high.glucose} OR BMI ≥ {THRESHOLDS.high.bmi}
              </li>
              <li>
                <span className="text-moderate">Moderate</span>: HbA1c ≥ {THRESHOLDS.moderate.hba1c} OR Glucose ≥{" "}
                {THRESHOLDS.moderate.glucose} OR BMI ≥ {THRESHOLDS.moderate.bmi}, and not High
              </li>
              <li>
                <span className="text-low">Low</span>: everyone else
              </li>
            </ul>
          </div>
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
            <h3 className="font-display text-sm font-semibold text-foreground">Percentiles</h3>
            <p className="mt-2">
              Percentile = share of valid cohort values strictly below your value plus half of the ties (mid-rank
              convention). It describes your standing within this dataset only — not a medical benchmark.
            </p>
          </div>
        </div>
        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-high/40 bg-high/10 px-4 py-3 text-sm text-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-high" />
          <span>
            <strong>Important:</strong> This tool is intended for educational/data-analysis purposes and is not a medical
            diagnostic tool. It does not diagnose diabetes or any other condition.
          </span>
        </p>
        <p className="mt-8 text-xs text-muted-foreground">
          MetaboLens — See the population. Understand your risk.
        </p>
      </div>
    </section>
  );
}
