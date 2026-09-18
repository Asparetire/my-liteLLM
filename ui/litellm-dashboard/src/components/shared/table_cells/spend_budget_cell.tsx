"use client";

import { InheritedBudgetHint, type InheritedBudgetGate } from "@/components/shared/InheritedBudgetHint";
import { Meter, MeterIndicator, MeterTrack } from "@/components/shared/Meter";
import { formatNumberWithCommas, getSpendString } from "@/utils/dataUtils";

interface SpendBudgetCellProps {
  spend: number | null | undefined;
  maxBudget: number | null | undefined;
  inheritedGates?: readonly InheritedBudgetGate[];
  /**
   * [CN-FORK] Unused since the token migration (REQ-06): token counts are integers.
   * Kept so existing callers keep compiling; will be removed with the REQ-06 sweep.
   */
  spendDecimals?: number;
  budgetDecimals?: number;
}

const meterTone = (pct: number): "default" | "warning" | "over" => {
  if (pct > 100) return "over";
  if (pct >= 80) return "warning";
  return "default";
};

export function SpendBudgetCell({ spend, maxBudget, inheritedGates = [] }: SpendBudgetCellProps) {
  const spendValue = typeof spend === "number" && !Number.isNaN(spend) ? spend : 0;
  const budget = maxBudget ?? null;
  const hasBudget = typeof budget === "number" && budget > 0;
  const pct = hasBudget ? (spendValue / budget) * 100 : 0;

  const spendText = spendValue > 0 ? getSpendString(spendValue) : "0 tokens";
  const budgetLabel = budget === null ? "· Unlimited" : `of ${formatNumberWithCommas(budget, 0)} tokens`;

  return (
    <div className="flex min-w-[130px] flex-col gap-1">
      <div className="whitespace-nowrap text-xs">
        <span className="font-medium tabular-nums text-foreground">{spendText}</span>{" "}
        <span className="text-muted-foreground">{budgetLabel}</span>
        {budget === null && <InheritedBudgetHint gates={inheritedGates} />}
      </div>
      {hasBudget && (
        <Meter
          value={spendValue}
          max={budget}
          aria-valuetext={`${spendText} of ${formatNumberWithCommas(budget, 0)} tokens`}
        >
          <MeterTrack>
            <MeterIndicator tone={meterTone(pct)} />
          </MeterTrack>
        </Meter>
      )}
    </div>
  );
}
