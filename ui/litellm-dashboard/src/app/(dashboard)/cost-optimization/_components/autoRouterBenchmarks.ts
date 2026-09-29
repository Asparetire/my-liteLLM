import type { components } from "@/lib/http/schema";

export type AutoRouterBenchmarksResponse = components["schemas"]["AutoRouterBenchmarksResponse"];
export type AutoRouterBenchmarkTotals = components["schemas"]["AutoRouterBenchmarkTotals"];
export type AutoRouterBenchmarkGroup = components["schemas"]["AutoRouterBenchmarkGroup"];
export type AutoRouterCacheStats = components["schemas"]["AutoRouterCacheStats"];

export const ALL_ROUTERS = "__all__";

export interface BenchmarkView {
  label: string;
  stats: AutoRouterBenchmarkTotals | AutoRouterBenchmarkGroup;
}

export const viewGroup = (view: BenchmarkView): AutoRouterBenchmarkGroup | null =>
  "router_name" in view.stats ? view.stats : null;

export const groupKey = (group: AutoRouterBenchmarkGroup): string => `${group.router_name} ${group.router_type}`;

export const groupLabel = (group: AutoRouterBenchmarkGroup, groups: readonly AutoRouterBenchmarkGroup[]): string => {
  const duplicated = groups.some((g) => g !== group && g.router_name === group.router_name);
  return duplicated ? `${group.router_name} (${group.router_type})` : group.router_name;
};

export const viewFor = (data: AutoRouterBenchmarksResponse, selectedKey: string, allLabel: string): BenchmarkView => {
  const group = data.groups.find((g) => groupKey(g) === selectedKey);
  if (selectedKey === ALL_ROUTERS || !group) {
    return { label: allLabel, stats: data.totals };
  }
  return { label: groupLabel(group, data.groups), stats: group };
};

export interface BucketRow {
  key: "same_model" | "first_visit" | "return_to_tier";
  label: string;
  sublabel: string;
  turns: number;
  sharePct: number;
  hitRatePct: number;
  fill: string;
}

export const bucketTurnsTotal = (cache: AutoRouterCacheStats): number =>
  cache.same_model.turns + cache.first_visit.turns + cache.return_to_tier.turns;

const sharePctOf = (turns: number, total: number): number => (total > 0 ? Math.round((100 * turns) / total) : 0);

export type BucketLabels = Record<BucketRow["key"], { label: string; sublabel: string }>;

const BUCKET_FILLS: Record<BucketRow["key"], string> = {
  same_model: "bg-foreground",
  first_visit: "bg-foreground/30",
  return_to_tier: "bg-foreground/60",
};

export const bucketRows = (cache: AutoRouterCacheStats, labels: BucketLabels): BucketRow[] => {
  const total = bucketTurnsTotal(cache);
  return (Object.keys(labels) as BucketRow["key"][]).map((key) => ({
    key,
    label: labels[key].label,
    sublabel: labels[key].sublabel,
    turns: cache[key].turns,
    sharePct: sharePctOf(cache[key].turns, total),
    hitRatePct: cache[key].hit_rate_pct,
    fill: BUCKET_FILLS[key],
  }));
};

export const expiredMissShare = (cache: AutoRouterCacheStats): number | null => {
  const total = bucketTurnsTotal(cache);
  if (total <= 0) return null;
  return (100 * cache.return_misses_expired) / total;
};

export const pctLabel = (value: number, digits: number = 1): string => `${value.toFixed(digits)}%`;

export const durationLabel = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};
