"use client";

import { formatNumberWithCommas, getSpendString } from "@/utils/dataUtils";

interface MoneyCellProps {
  value: number | null | undefined;
  /**
   * [CN-FORK] Unused since the token migration (REQ-06): token counts are integers.
   * Kept so existing callers keep compiling; will be removed with the REQ-06 sweep.
   */
  decimals?: number;
  emptyText?: string;
  showZero?: boolean;
}

const placeholderClassName = "block w-full whitespace-nowrap text-right tabular-nums text-muted-foreground";
const moneyClassName = "block w-full whitespace-nowrap text-right tabular-nums";

export function MoneyCell({ value, emptyText = "-", showZero = false }: MoneyCellProps) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={placeholderClassName}>{emptyText}</span>;
  }
  if (value === 0 && !showZero) {
    return <span className={placeholderClassName}>-</span>;
  }

  const formattedValue = value === 0 ? `${formatNumberWithCommas(0, 0)} tokens` : getSpendString(value);

  return (
    <span data-slot="money-cell" className={moneyClassName}>
      {formattedValue}
    </span>
  );
}
