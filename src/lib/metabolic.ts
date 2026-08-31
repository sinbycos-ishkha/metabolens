/**
 * MetaboLens — core data-science layer.
 *
 * All cohort analytics and the personal calculator share the functions in this
 * module, so the rule-based risk model exists in exactly one place.
 *
 * Preprocessing approach (documented for transparency / the Methodology panel):
 *  1. Column names are normalised through a mapping layer (case/space/unit
 *     tolerant) so slightly different headers do not break the app.
 *  2. Numeric columns are coerced; blanks / non-numeric / non-positive values
 *     for Height_cm and Weight_kg are treated as MISSING (never as zero).
 *  3. Missing Height_cm, Weight_kg, Blood_Glucose and HbA1c are filled with the
 *     column MEDIAN (robust to skew, keeps sample size intact).
 *  4. BMI is derived after imputation: BMI = kg / (cm/100)^2, and rows whose
 *     BMI is outside a plausible range are excluded from the analysed cohort.
 *  5. The source CSV is only ever read — never written to.
 */

export type RiskTier = "Low Risk" | "Moderate Risk" | "High Risk";

export const THRESHOLDS = {
  high: { hba1c: 6.5, glucose: 140, bmi: 30 },
  moderate: { hba1c: 5.7, glucose: 100, bmi: 25 },
} as const;

export interface Participant {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  waistCm: number | null;
  glucose: number;
  hba1c: number;
  bmi: number;
  tier: RiskTier;
}

export interface PreprocessReport {
  rowsInFile: number;
  rowsAnalysed: number;
  rowsDropped: number;
  imputed: Record<string, number>;
  medians: Record<string, number>;
}

export interface Cohort {
  participants: Participant[];
  report: PreprocessReport;
  bmiValues: number[];
  glucoseValues: number[];
  hba1cValues: number[];
  medians: { bmi: number; glucose: number; hba1c: number; age: number };
}

/* ------------------------------------------------------------------ helpers */

export function median(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!v.length) return NaN;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function mean(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null; // guard against 0/negative
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight range";
  return "Obesity range";
}

/**
 * CORE RULE-BASED CLASSIFIER.
 *
 * Order matters: High Risk is evaluated first, then Moderate Risk, otherwise
 * Low Risk — this makes the three tiers mutually exclusive.
 * Missing (null/undefined) optional measurements are simply not evaluated;
 * they are NEVER coerced to 0.
 */
export function calculateRiskTier(
  hba1c: number | null | undefined,
  glucose: number | null | undefined,
  bmi: number | null | undefined,
): RiskTier {
  const a = Number.isFinite(hba1c as number) ? (hba1c as number) : null;
  const g = Number.isFinite(glucose as number) ? (glucose as number) : null;
  const b = Number.isFinite(bmi as number) ? (bmi as number) : null;

  // 1) High Risk
  if (
    (a !== null && a >= THRESHOLDS.high.hba1c) ||
    (g !== null && g >= THRESHOLDS.high.glucose) ||
    (b !== null && b >= THRESHOLDS.high.bmi)
  ) {
    return "High Risk";
  }
  // 2) Moderate Risk (only if not already High Risk)
  if (
    (a !== null && a >= THRESHOLDS.moderate.hba1c) ||
    (g !== null && g >= THRESHOLDS.moderate.glucose) ||
    (b !== null && b >= THRESHOLDS.moderate.bmi)
  ) {
    return "Moderate Risk";
  }
  // 3) Low Risk
  return "Low Risk";
}

/**
 * Percentile standing = share of valid cohort values STRICTLY BELOW the user's
 * value, plus half of the ties (mid-rank convention) so identical values do not
 * report 0%. Expressed relative to THIS dataset only.
 */
export function calculatePercentile(values: number[], value: number): number {
  const valid = values.filter((n) => Number.isFinite(n));
  if (!valid.length || !Number.isFinite(value)) return NaN;
  let below = 0;
  let ties = 0;
  for (const v of valid) {
    if (v < value) below++;
    else if (v === value) ties++;
  }
  return ((below + ties / 2) / valid.length) * 100;
}

/* ------------------------------------------------------- CSV + preprocessing */

const COLUMN_MAP: Record<string, string> = {
  age: "age",
  gender: "gender",
  sex: "gender",
  height_cm: "heightCm",
  height: "heightCm",
  heightcm: "heightCm",
  weight_kg: "weightKg",
  weight: "weightKg",
  weightkg: "weightKg",
  waist_circumference_cm: "waistCm",
  waist_circumference: "waistCm",
  waist: "waistCm",
  blood_glucose: "glucose",
  bloodglucose: "glucose",
  glucose: "glucose",
  blood_glucose_mg_dl: "glucose",
  hba1c: "hba1c",
  hb_a1c: "hba1c",
  a1c: "hba1c",
};

function normaliseHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[()%/]/g, "")
    .replace(/[\s.-]+/g, "_")
    .replace(/_+/g, "_");
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface RawRow {
  age: number | null;
  gender: string;
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  glucose: number | null;
  hba1c: number | null;
}

export function preprocessData(rows: Record<string, string>[]): Cohort {
  // map headers -> canonical keys
  const mapped: RawRow[] = rows.map((row) => {
    const canon: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const target = COLUMN_MAP[normaliseHeader(key)];
      if (target) canon[target] = value;
    }
    const heightCm = num(canon.heightCm);
    const weightKg = num(canon.weightKg);
    return {
      age: num(canon.age),
      gender: (canon.gender || "Unknown").trim(),
      // invalid (<=0) height/weight is treated as missing, not as a real value
      heightCm: heightCm !== null && heightCm > 0 ? heightCm : null,
      weightKg: weightKg !== null && weightKg > 0 ? weightKg : null,
      waistCm: num(canon.waistCm),
      glucose: num(canon.glucose),
      hba1c: num(canon.hba1c),
    };
  });

  const medians = {
    heightCm: median(mapped.map((r) => r.heightCm!).filter(Number.isFinite)),
    weightKg: median(mapped.map((r) => r.weightKg!).filter(Number.isFinite)),
    glucose: median(mapped.map((r) => r.glucose!).filter(Number.isFinite)),
    hba1c: median(mapped.map((r) => r.hba1c!).filter(Number.isFinite)),
    age: median(mapped.map((r) => r.age!).filter(Number.isFinite)),
  };

  const imputed: Record<string, number> = {
    Height_cm: 0,
    Weight_kg: 0,
    Blood_Glucose: 0,
    HbA1c: 0,
  };

  const participants: Participant[] = [];
  for (const r of mapped) {
    let heightCm = r.heightCm;
    let weightKg = r.weightKg;
    let glucose = r.glucose;
    let hba1c = r.hba1c;

    if (heightCm === null) (heightCm = medians.heightCm), imputed.Height_cm++;
    if (weightKg === null) (weightKg = medians.weightKg), imputed.Weight_kg++;
    if (glucose === null) (glucose = medians.glucose), imputed.Blood_Glucose++;
    if (hba1c === null) (hba1c = medians.hba1c), imputed.HbA1c++;

    const age = r.age !== null && r.age > 0 && r.age < 120 ? r.age : medians.age;
    const bmi = calculateBmi(weightKg, heightCm);
    if (bmi === null || bmi < 10 || bmi > 80) continue; // implausible → excluded

    participants.push({
      age,
      gender: r.gender,
      heightCm,
      weightKg,
      waistCm: r.waistCm,
      glucose,
      hba1c,
      bmi,
      tier: calculateRiskTier(hba1c, glucose, bmi),
    });
  }

  return {
    participants,
    report: {
      rowsInFile: rows.length,
      rowsAnalysed: participants.length,
      rowsDropped: rows.length - participants.length,
      imputed,
      medians: {
        Height_cm: medians.heightCm,
        Weight_kg: medians.weightKg,
        Blood_Glucose: medians.glucose,
        HbA1c: medians.hba1c,
      },
    },
    bmiValues: participants.map((p) => p.bmi),
    glucoseValues: participants.map((p) => p.glucose),
    hba1cValues: participants.map((p) => p.hba1c),
    medians: {
      bmi: median(participants.map((p) => p.bmi)),
      glucose: median(participants.map((p) => p.glucose)),
      hba1c: median(participants.map((p) => p.hba1c)),
      age: median(participants.map((p) => p.age)),
    },
  };
}

const CSV_CANDIDATES = [
  "/data/diabetes_risk_prediction_dataset-selected-columns.csv",
  "/data/diabetes_risk_prediction_dataset-selected-columns_2.csv",
  "/data/dataset.csv",
];

/** Loads the first available CSV (read-only) and preprocesses it once. */
export async function loadData(): Promise<Cohort> {
  for (const path of CSV_CANDIDATES) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim()) continue;
      const cohort = preprocessData(parseCsv(text));
      if (cohort.participants.length) return cohort;
    } catch {
      // try the next candidate path
    }
  }
  throw new Error("No usable dataset CSV found in /data.");
}

/* -------------------------------------------------- personal assessment bits */

export interface PersonalInput {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  waistCm: number;
  glucose: number | null;
  hba1c: number | null;
}

export function generateSuggestions(input: PersonalInput, bmi: number, tier: RiskTier): string[] {
  const out: string[] = [];
  if (bmi >= THRESHOLDS.high.bmi) {
    out.push(
      "Your BMI is in the higher range. Regular physical activity and sustainable, balanced eating habits are the most reliable long-term levers.",
    );
  } else if (bmi >= THRESHOLDS.moderate.bmi) {
    out.push(
      "Your BMI sits slightly above the healthy range. Steady activity — around 150 minutes of moderate movement a week — plus balanced meals can help.",
    );
  }
  if (input.glucose !== null && input.glucose >= THRESHOLDS.high.glucose) {
    out.push(
      "Your blood glucose reading is notably elevated. It is worth discussing repeated elevated readings with a qualified healthcare professional.",
    );
  } else if (input.glucose !== null && input.glucose >= THRESHOLDS.moderate.glucose) {
    out.push(
      "Your glucose reading is mildly elevated. Favour balanced meals with fibre and protein, and keep activity regular; re-check over time.",
    );
  }
  if (input.hba1c !== null && input.hba1c >= THRESHOLDS.moderate.hba1c) {
    out.push(
      "Your HbA1c is above the lower band. Professional follow-up is sensible, particularly if elevated values repeat, alongside consistent activity and nutrition.",
    );
  }
  if (input.waistCm > 0 && input.waistCm >= (input.gender === "Male" ? 102 : 88)) {
    out.push(
      "Waist measurement is in a higher range. Central measurements often respond well to regular walking, strength work and sleep consistency.",
    );
  }
  if (!out.length || tier === "Low Risk") {
    out.push(
      "Your inputs land in the lower band. Keeping up regular activity, balanced nutrition and routine health check-ups is the best way to stay there.",
    );
  }
  return out.slice(0, 3);
}

export interface ExplanationLine {
  text: string;
  state: "trigger" | "clear" | "missing";
}

export function generateRiskExplanation(
  bmi: number,
  glucose: number | null,
  hba1c: number | null,
  tier: RiskTier,
): ExplanationLine[] {
  const lines: ExplanationLine[] = [];

  // BMI
  if (bmi >= THRESHOLDS.high.bmi) {
    lines.push({ text: `BMI ${bmi.toFixed(1)} is at or above the High Risk threshold (≥ 30)`, state: "trigger" });
  } else if (bmi >= THRESHOLDS.moderate.bmi) {
    lines.push({
      text: `BMI ${bmi.toFixed(1)} is at or above the Moderate Risk threshold (≥ 25) but below 30`,
      state: "trigger",
    });
  } else {
    lines.push({ text: `BMI ${bmi.toFixed(1)} is below the Moderate Risk threshold (< 25)`, state: "clear" });
  }

  // Glucose
  if (glucose === null) {
    lines.push({ text: "Blood Glucose was not provided, so it could not be evaluated", state: "missing" });
  } else if (glucose >= THRESHOLDS.high.glucose) {
    lines.push({ text: `Blood Glucose ${glucose} mg/dL is at or above the High Risk threshold (≥ 140)`, state: "trigger" });
  } else if (glucose >= THRESHOLDS.moderate.glucose) {
    lines.push({
      text: `Blood Glucose ${glucose} mg/dL meets the Moderate Risk threshold (≥ 100) but is below 140`,
      state: "trigger",
    });
  } else {
    lines.push({ text: `Blood Glucose ${glucose} mg/dL is below the Moderate Risk threshold (< 100)`, state: "clear" });
  }

  // HbA1c
  if (hba1c === null) {
    lines.push({ text: "HbA1c was not provided, so it could not be evaluated", state: "missing" });
  } else if (hba1c >= THRESHOLDS.high.hba1c) {
    lines.push({ text: `HbA1c ${hba1c}% is at or above the High Risk threshold (≥ 6.5)`, state: "trigger" });
  } else if (hba1c >= THRESHOLDS.moderate.hba1c) {
    lines.push({ text: `HbA1c ${hba1c}% meets the Moderate Risk threshold (≥ 5.7) but is below 6.5`, state: "trigger" });
  } else {
    lines.push({ text: `HbA1c ${hba1c}% is below the Moderate Risk threshold (< 5.7)`, state: "clear" });
  }

  lines.push({
    text:
      tier === "High Risk"
        ? "At least one High Risk rule was met, and High Risk is evaluated first."
        : tier === "Moderate Risk"
          ? "No High Risk rule was met, and at least one Moderate Risk rule was met."
          : "No High Risk or Moderate Risk rule was met.",
    state: tier === "Low Risk" ? "clear" : "trigger",
  });

  return lines;
}

/** Simple equal-width histogram helper for the distribution charts. */
export function histogram(values: number[], bins: number, decimals = 0) {
  const valid = values.filter((n) => Number.isFinite(n));
  if (!valid.length) return [];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const width = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of valid) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    buckets[idx].count++;
  }
  return buckets.map((b) => ({
    label: b.start.toFixed(decimals),
    center: (b.start + b.end) / 2,
    range: `${b.start.toFixed(decimals)} – ${b.end.toFixed(decimals)}`,
    count: b.count,
  }));
}
