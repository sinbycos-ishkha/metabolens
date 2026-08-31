import { useQuery } from "@tanstack/react-query";
import { loadData, type Cohort } from "@/lib/metabolic";

/**
 * Loads + preprocesses the dataset exactly once per session and caches it.
 * Inputs changing in the calculator never re-read the CSV.
 */
export function useCohort() {
  return useQuery<Cohort>({
    queryKey: ["cohort"],
    queryFn: loadData,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
