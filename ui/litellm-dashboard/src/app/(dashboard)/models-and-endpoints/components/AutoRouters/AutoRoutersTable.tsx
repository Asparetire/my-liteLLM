"use client";

import { SortingState } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { AutoRouterIcon } from "@/components/shared/table_cells";

import { getAutoRoutersTableColumns } from "./AutoRoutersTableColumns";
import { AutoRouterRow } from "./autoRouterRows";

interface AutoRoutersTableProps {
  routers: AutoRouterRow[];
  isLoading: boolean;
  canModify: boolean;
  onRouterClick: (row: AutoRouterRow) => void;
  onDeleteClick: (row: AutoRouterRow) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const DEFAULT_SORTING: SortingState = [
  { id: "createdAt", desc: true },
  { id: "name", desc: false },
];

function EmptyState({ canModify }: { canModify: boolean }) {
  const t = useTranslations("modelsEndpoints");
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
        <AutoRouterIcon size={20} className="text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-foreground">{t("noAutoRoutersTitle")}</div>
      <div className="text-sm text-muted-foreground">
        {canModify ? t("noAutoRoutersCanCreate") : t("noAutoRoutersReadOnly")}
      </div>
    </div>
  );
}

export function AutoRoutersTable({
  routers,
  isLoading,
  canModify,
  onRouterClick,
  onDeleteClick,
}: AutoRoutersTableProps) {
  const t = useTranslations("modelsEndpoints");
  const columnDeps = useMemo(
    () => ({ canModify, t, onRouterClick, onDeleteClick }),
    [canModify, t, onRouterClick, onDeleteClick],
  );
  const columns = useMemo(() => getAutoRoutersTableColumns(columnDeps), [columnDeps]);

  return (
    <DataTable
      data={routers}
      columns={columns}
      getRowId={(router) => router.id}
      sortingMode="client"
      defaultSorting={DEFAULT_SORTING}
      paginationMode="client"
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      isLoading={isLoading}
      loadingMessage={t("loadingAutoRouters")}
      noDataMessage={<EmptyState canModify={canModify} />}
      size="compact"
    />
  );
}
