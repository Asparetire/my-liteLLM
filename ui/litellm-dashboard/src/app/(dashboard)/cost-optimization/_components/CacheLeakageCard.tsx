"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import AdvancedDatePicker from "@/components/shared/advanced_date_picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import {
  CacheLeakageDimension,
  CacheLeakageRow,
  computeCacheLeakage,
  pct,
  tokenSpend,
} from "./costOptimizationUtils";
import { DailyActivityRange } from "./useDailyActivityRange";

interface CacheLeakageCardProps {
  activity: DailyActivityRange;
}

type SortColumn = "uncachedPromptTokens" | "cacheHitRatio" | "potentialSavings";
interface SortState {
  column: SortColumn;
  dir: "asc" | "desc";
}

const NATURAL_DIR: Record<SortColumn, "asc" | "desc"> = {
  uncachedPromptTokens: "desc",
  cacheHitRatio: "asc",
  potentialSavings: "desc",
};

const compareRows = (a: CacheLeakageRow, b: CacheLeakageRow, sort: SortState): number => {
  const av = a[sort.column];
  const bv = b[sort.column];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return sort.dir === "asc" ? av - bv : bv - av;
};

const InfoTooltip = ({ info }: { info: string }) => (
  <Tooltip>
    <TooltipTrigger render={<span className="inline-flex" aria-label={info} />}>
      <Info className="h-3 w-3 text-muted-foreground" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">{info}</TooltipContent>
  </Tooltip>
);

const SortableHead = ({
  column,
  label,
  info,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  info: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
}) => {
  const t = useTranslations("costOptimization");
  const active = sort.column === column;
  const ActiveArrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  const Arrow = active ? ActiveArrow : ArrowUpDown;
  return (
    <TableHead className="text-right">
      <span className="inline-flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onSort(column)}
          aria-label={t("sortBy", { label })}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        >
          {label}
          <Arrow className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground"}`} />
        </button>
        <InfoTooltip info={info} />
      </span>
    </TableHead>
  );
};

const CacheLeakageCard: React.FC<CacheLeakageCardProps> = ({ activity }) => {
  const t = useTranslations("costOptimization");
  const tCommon = useTranslations("common");
  const { dateValue, onDateChange, results, loading, isFetchingMore } = activity;
  const [dimension, setDimension] = useState<CacheLeakageDimension>("key");
  const [sort, setSort] = useState<SortState>({ column: "potentialSavings", dir: "desc" });
  const leakage = useMemo(() => computeCacheLeakage(results, dimension), [results, dimension]);
  const rows = useMemo(() => [...leakage.rows].sort((a, b) => compareRows(a, b, sort)), [leakage.rows, sort]);

  const onSort = (column: SortColumn) =>
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: NATURAL_DIR[column] },
    );

  const firstColumn = dimension === "model" ? t("modelCol") : t("keyCol");
  const loadingText = loading || isFetchingMore ? tCommon("loading") : null;
  const emptyText = loadingText ?? (dimension === "model" ? t("noModelUsage") : t("noKeyUsage"));

  return (
    <TooltipProvider delay={300}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle>{dimension === "model" ? t("leakageByModel") : t("leakageByKey")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {dimension === "model" ? t("leakageDescByModel") : t("leakageDescByKey")}
              </p>
            </div>
            <div className="shrink-0">
              <AdvancedDatePicker value={dateValue} onValueChange={onDateChange} />
            </div>
          </div>
          <Tabs value={dimension} onValueChange={(value) => setDimension(value === "model" ? "model" : "key")}>
            <TabsList>
              <TabsTrigger value="key">{t("byVirtualKeyTab")}</TabsTrigger>
              <TabsTrigger value="model">{t("byModelTab")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {rows.length > 0 && isFetchingMore && (
            <p className="mb-2 text-sm text-muted-foreground">{t("stillLoading")}</p>
          )}
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{firstColumn}</TableHead>
                  <SortableHead
                    column="uncachedPromptTokens"
                    label={t("uncachedCol")}
                    info={t("uncachedInfo")}
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortableHead
                    column="cacheHitRatio"
                    label={t("hitRateCol")}
                    info={t("hitRateInfo")}
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortableHead
                    column="potentialSavings"
                    label={t("potentialCol")}
                    info={t("potentialInfo")}
                    sort={sort}
                    onSort={onSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.label}
                      {row.sublabel && <span className="ml-1 text-xs text-muted-foreground">({row.sublabel})</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatNumberWithCommas(row.uncachedPromptTokens)}</TableCell>
                    <TableCell className="text-right">{pct(row.cacheHitRatio)}</TableCell>
                    <TableCell className="text-right">
                      {row.potentialSavings == null ? "—" : tokenSpend(row.potentialSavings)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default CacheLeakageCard;
