# MetaboLens

**See the population. Understand your risk.**

An interactive metabolic risk calculator and cohort analytics dashboard. Explore rule-based
metabolic risk patterns across a participant cohort, then enter your own measurements to get
BMI, a rule-based risk tier, percentile standing within the dataset and general lifestyle
suggestions.

> **Important:** MetaboLens is an educational / data-analysis screening tool. It does **not**
> diagnose diabetes or any other condition.

## Stack

React 19 + TypeScript + TanStack Start (Vite), Tailwind CSS v4, Recharts. All data science
(loading, preprocessing, BMI, risk tiers, percentiles, suggestions, explanations) lives in
`src/lib/metabolic.ts` and is shared by both the cohort dashboard and the personal calculator.

## Run locally

```bash
bun install       # or: npm install
bun run dev       # or: npm run dev
```

Open http://localhost:8080

Build for production: `bun run build` then `bun run preview`.

## Dataset

`public/data/diabetes_risk_prediction_dataset-selected-columns.csv`

The loader tries, in order:

1. `diabetes_risk_prediction_dataset-selected-columns.csv`
2. `diabetes_risk_prediction_dataset-selected-columns_2.csv`
3. `dataset.csv`

Expected columns: `Age, Gender, Height_cm, Weight_kg, Waist_Circumference_cm, Blood_Glucose, HbA1c`.
Slightly different headers are handled by a normalising mapping layer, so the app does not break.
The CSV is read-only — preprocessing never writes back to it.

## Preprocessing

- Numeric coercion; blank / non-numeric values become `null` (never `0`).
- Zero or negative `Height_cm` / `Weight_kg` are treated as missing.
- Median imputation for `Height_cm`, `Weight_kg`, `Blood_Glucose`, `HbA1c` (robust to skew).
- `BMI = Weight_kg / (Height_cm / 100)^2`; rows with implausible BMI (<10 or >80) are excluded.
- Loaded and preprocessed once per session and cached via TanStack Query.

## Risk model (evaluated in this order — tiers are mutually exclusive)

| Tier | Rule |
| --- | --- |
| High Risk | `HbA1c >= 6.5` OR `Blood_Glucose >= 140` OR `BMI >= 30` |
| Moderate Risk | (`HbA1c >= 5.7` OR `Blood_Glucose >= 100` OR `BMI >= 25`) and not High Risk |
| Low Risk | everything else |

One function, `calculateRiskTier(hba1c, glucose, bmi)`, classifies both the cohort and the user.
Missing optional inputs are skipped rather than treated as zero, and the UI states which
measurements were unavailable.

## Percentiles

`percentile = (values strictly below your value + half of ties) / valid values * 100`
(mid-rank convention). This is your standing within the provided dataset only.

## Core functions

`loadData()`, `preprocessData()`, `calculateBmi()`, `calculateRiskTier()`,
`calculatePercentile()`, `generateSuggestions()`, `generateRiskExplanation()`, `histogram()`
