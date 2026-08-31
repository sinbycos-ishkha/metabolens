import { createFileRoute } from "@tanstack/react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import { useCohort } from "@/hooks/useCohort";
import { Nav } from "@/components/metabolens/Nav";
import { Hero } from "@/components/metabolens/Hero";
import { PopulationDashboard } from "@/components/metabolens/PopulationDashboard";
import { PersonalAssessment } from "@/components/metabolens/PersonalAssessment";
import { Methodology } from "@/components/metabolens/Methodology";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MetaboLens — Interactive Metabolic Risk Calculator & Cohort Analytics" },
      {
        name: "description",
        content:
          "Explore metabolic risk across a population cohort, then calculate your BMI, rule-based risk tier and percentile standing. Educational screening tool, not a diagnosis.",
      },
      { property: "og:title", content: "MetaboLens — See the population. Understand your risk." },
      {
        property: "og:description",
        content:
          "Population metabolic risk analytics plus a personal BMI, risk-tier and percentile assessment built on a transparent rule-based model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: cohort, isLoading, error } = useCohort();

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero participants={cohort?.participants.length ?? null} />

        {isLoading ? (
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-24 text-sm text-muted-foreground sm:px-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading and preprocessing the cohort dataset…
          </div>
        ) : error || !cohort ? (
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <div className="glass flex items-start gap-3 rounded-2xl p-6 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-high" />
              <div>
                <p className="font-display text-base font-semibold">Dataset could not be loaded</p>
                <p className="mt-1 text-muted-foreground">
                  Place <code className="text-primary">diabetes_risk_prediction_dataset-selected-columns.csv</code> in{" "}
                  <code className="text-primary">public/data/</code> and reload.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <PopulationDashboard cohort={cohort} />
            <PersonalAssessment cohort={cohort} />
            <Methodology cohort={cohort} />
          </>
        )}
      </main>
    </div>
  );
}
