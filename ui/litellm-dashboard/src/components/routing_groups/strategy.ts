const STRATEGY_LABELS: Readonly<Record<string, string>> = {
  "simple-shuffle": "Simple Shuffle",
  "least-busy": "Least Busy",
  "usage-based-routing": "Usage Based",
  "latency-based-routing": "Latency Based",
};

export const formatStrategyLabel = (strategy: string): string => STRATEGY_LABELS[strategy] ?? strategy;

// Message keys for the friendly labels above, resolved by the caller through
// next-intl so the display name can be translated.
const STRATEGY_LABEL_KEYS: Readonly<Record<string, string>> = {
  "simple-shuffle": "strategySimpleShuffle",
  "least-busy": "strategyLeastBusy",
  "usage-based-routing": "strategyUsageBased",
  "latency-based-routing": "strategyLatencyBased",
};

export const localizedStrategyLabel = (strategy: string, t: (key: string) => string): string => {
  const key = STRATEGY_LABEL_KEYS[strategy];
  return key ? t(key) : strategy;
};
