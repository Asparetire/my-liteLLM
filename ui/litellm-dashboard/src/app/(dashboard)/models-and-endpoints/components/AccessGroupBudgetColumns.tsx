"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Trash2, Wallet } from "lucide-react";

import { getBudgetDurationLabel } from "@/components/common_components/budget_duration_dropdown";
import { DataTableSortHeader } from "@/components/shared/DataTable";
import { ModelsCell, SpendBudgetCell } from "@/components/shared/table_cells";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cva.config";
import { ModelAccessGroup } from "@/app/(dashboard)/hooks/modelAccessGroups/useModelAccessGroups";

type Translator = (key: string, values?: Record<string, string | number>) => string;

const writeBlockedReason = (
  accessGroup: ModelAccessGroup,
  canWrite: boolean,
  t: Translator,
): string | undefined => {
  if (!canWrite) return t("onlyProxyAdminCanChangeBudget");
  if (!isBudgetAddressable(accessGroup.access_group)) {
    return t("slashGroupNoBudget");
  }
  return undefined;
};

const budgetDecimals = (maxBudget: number | null | undefined): number =>
  maxBudget != null && maxBudget > 0 && maxBudget < 0.01 ? 5 : 2;

/**
 * A group name is a free-text path segment on the budget routes, so a `/` in it splits the path and
 * no encoding recovers it. Such a group is listed but its budget is unreachable.
 */
export const isBudgetAddressable = (accessGroup: string): boolean => !accessGroup.includes("/");

interface AccessGroupRowActionsProps {
  accessGroup: ModelAccessGroup;
  canWrite: boolean;
  onSetBudget: (accessGroup: ModelAccessGroup) => void;
  onClearBudget: (accessGroup: ModelAccessGroup) => void;
}

function AccessGroupRowActions({ accessGroup, canWrite, onSetBudget, onClearBudget }: AccessGroupRowActionsProps) {
  const t = useTranslations("modelsEndpoints");
  const hasBudget = accessGroup.budget != null;
  const blocked = writeBlockedReason(accessGroup, canWrite, t);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("openBudgetActionsAria", { group: accessGroup.access_group })}
        data-testid={`access-group-actions-${accessGroup.access_group}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={blocked !== undefined}
          title={blocked}
          data-testid="access-group-action-set-budget"
          onClick={() => onSetBudget(accessGroup)}
        >
          <Wallet />
          {hasBudget ? t("editBudget") : t("setBudget")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={blocked !== undefined || !hasBudget}
          data-testid="access-group-action-clear-budget"
          title={blocked ?? (hasBudget ? undefined : t("noBudgetToClear"))}
          onClick={() => onClearBudget(accessGroup)}
        >
          <Trash2 />
          {t("clearBudget")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AccessGroupBudgetColumnsDeps {
  canWrite: boolean;
  t: Translator;
  onSetBudget: (accessGroup: ModelAccessGroup) => void;
  onClearBudget: (accessGroup: ModelAccessGroup) => void;
}

export const getAccessGroupBudgetColumns = ({
  canWrite,
  t,
  onSetBudget,
  onClearBudget,
}: AccessGroupBudgetColumnsDeps): ColumnDef<ModelAccessGroup>[] => [
  {
    id: "access_group",
    accessorKey: "access_group",
    meta: { title: t("colAccessGroup") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colAccessGroup")} />,
    size: 220,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block max-w-56 truncate font-mono text-xs" title={row.original.access_group}>
        {row.original.access_group}
      </span>
    ),
  },
  {
    id: "models",
    meta: { title: t("colModels"), skeleton: "chips" },
    header: t("colModels"),
    size: 280,
    enableSorting: false,
    cell: ({ row }) => <ModelsCell models={row.original.model_names} />,
  },
  {
    id: "deployment_count",
    accessorKey: "deployment_count",
    meta: { title: t("colDeployments"), numeric: true },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colDeployments")} />,
    size: 120,
    enableSorting: true,
    cell: ({ row }) => row.original.deployment_count,
  },
  {
    id: "spend",
    accessorKey: "spend",
    meta: { title: t("colSharedSpend") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colSharedSpend")} />,
    size: 180,
    enableSorting: true,
    cell: ({ row }) => (
      <SpendBudgetCell
        spend={row.original.spend}
        maxBudget={row.original.budget?.max_budget}
        budgetDecimals={budgetDecimals(row.original.budget?.max_budget)}
      />
    ),
  },
  {
    id: "budget_duration",
    meta: { title: t("colResets") },
    header: t("colResets"),
    size: 110,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {getBudgetDurationLabel(row.original.budget?.budget_duration)}
      </span>
    ),
  },
  {
    id: "actions",
    meta: { className: "text-right", headerClassName: "text-right" },
    header: () => <span className="sr-only">{t("colActions")}</span>,
    size: 64,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <AccessGroupRowActions
          accessGroup={row.original}
          canWrite={canWrite}
          onSetBudget={onSetBudget}
          onClearBudget={onClearBudget}
        />
      </div>
    ),
  },
];
