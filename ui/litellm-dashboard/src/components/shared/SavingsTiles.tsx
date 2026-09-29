"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";

import SummaryCard from "@/components/shared/SummaryCard";
import {
  autorouterOf,
  cachingOf,
  compressionOf,
  gatewayAttributedCachingOf,
  SAVINGS_DRIVERS,
  savedTokensOf,
  sumOverDays,
  usd,
} from "@/app/(dashboard)/cost-optimization/_components/costOptimizationUtils";
import { DailyData } from "@/components/UsagePage/types";
import { formatNumberWithCommas } from "@/utils/dataUtils";

// The total sums SAVINGS_DRIVERS, so it is by construction the sum of what the
// charts plot; the donut and timelines derive from the same list in costOptimizationUtils.
const useSavingsTotals = (results: DailyData[]) =>
  useMemo(
    () => ({
      compression: sumOverDays(results, compressionOf),
      caching: sumOverDays(results, cachingOf),
      autorouter: sumOverDays(results, autorouterOf),
      gatewayAttributedCaching: sumOverDays(results, gatewayAttributedCachingOf),
      savedTokens: sumOverDays(results, savedTokensOf),
      total: SAVINGS_DRIVERS.reduce((sum, { of }) => sum + sumOverDays(results, of), 0),
    }),
    [results],
  );

const SavingsTiles = ({ results, isLoading }: { results: DailyData[]; isLoading: boolean }) => {
  const t = useTranslations("costOptimization");
  const tCommon = useTranslations("common");
  const totals = useSavingsTotals(results);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label={t("totalSaved")}
        value={usd(totals.total)}
        hint={isLoading ? tCommon("loading") : t("totalSavedHint")}
        info={t("totalSavedInfo")}
      />
      <SummaryCard
        label={t("compressionSavings")}
        value={usd(totals.compression)}
        hint={t("tokensCompressed", { count: formatNumberWithCommas(totals.savedTokens) })}
        info={t("compressionSavingsInfo")}
      />
      <SummaryCard
        label={t("cachingSavings")}
        value={usd(totals.gatewayAttributedCaching)}
        hint={t("litellmInjected")}
        secondary={{ label: t("secondaryTotal"), value: usd(totals.caching) }}
        info={t("cachingSavingsInfo")}
      />
      <SummaryCard
        label={t("autoRouterSavings")}
        value={usd(totals.autorouter)}
        hint={t("vsPriciestModel")}
        info={t("autoRouterSavingsInfo")}
      />
    </div>
  );
};

export default SavingsTiles;
