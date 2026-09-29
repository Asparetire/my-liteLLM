import { formatNumberWithCommas } from "@/utils/dataUtils";

export interface SummaryTile {
  title: string;
  value: string;
  className?: string;
  tooltip?: string;
  expandable?: boolean;
}

export interface SummaryLabels {
  totalCost: string;
  totalSpend: string;
  totalRequests: string;
  successfulRequests: string;
  failedRequests: string;
  totalTokens: string;
  requestCost: string;
  flatCost: string;
  totalCostTooltip: string;
  requestCostTooltip: string;
  flatCostTooltip: string;
}

interface SpendSummaryMetadata {
  total_spend: number;
  total_flat_cost?: number;
  total_api_requests: number;
  total_successful_requests: number;
  total_failed_requests: number;
  total_tokens: number;
}

export const hasFlatCost = (metadata: SpendSummaryMetadata): boolean => (metadata.total_flat_cost ?? 0) > 0;

export const buildSummaryTiles = (
  metadata: SpendSummaryMetadata,
  showFlatCost: boolean,
  labels: SummaryLabels,
): SummaryTile[] => {
  const flatCost = metadata.total_flat_cost ?? 0;
  return [
    showFlatCost
      ? {
          title: labels.totalCost,
          value: `${formatNumberWithCommas(metadata.total_spend + flatCost, 0)} tokens`,
          tooltip: labels.totalCostTooltip,
          expandable: true,
        }
      : { title: labels.totalSpend, value: `${formatNumberWithCommas(metadata.total_spend, 0)} tokens` },
    { title: labels.totalRequests, value: metadata.total_api_requests.toLocaleString() },
    {
      title: labels.successfulRequests,
      value: metadata.total_successful_requests.toLocaleString(),
      className: "text-success",
    },
    { title: labels.failedRequests, value: metadata.total_failed_requests.toLocaleString(), className: "text-destructive" },
    { title: labels.totalTokens, value: metadata.total_tokens.toLocaleString() },
  ];
};

export const buildCostBreakdownTiles = (metadata: SpendSummaryMetadata, labels: SummaryLabels): SummaryTile[] => [
  {
    title: labels.requestCost,
    value: `${formatNumberWithCommas(metadata.total_spend, 0)} tokens`,
    className: "text-info",
    tooltip: labels.requestCostTooltip,
  },
  {
    title: labels.flatCost,
    value: `${formatNumberWithCommas(metadata.total_flat_cost ?? 0, 0)} tokens`,
    className: "text-violet-600",
    tooltip: labels.flatCostTooltip,
  },
];
