"use client";

import { SortingState } from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";

import DeleteResourceModal from "@/components/common_components/DeleteResourceModal";
import { DataTable } from "@/components/shared/DataTable";
import { toast } from "@/lib/toast";
import { isProxyAdminRole } from "@/utils/roles";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { ModelAccessGroup, useModelAccessGroups } from "@/app/(dashboard)/hooks/modelAccessGroups/useModelAccessGroups";
import { useDeleteModelAccessGroupBudget } from "@/app/(dashboard)/hooks/modelAccessGroups/useDeleteModelAccessGroupBudget";
import {
  SetModelAccessGroupBudgetParams,
  useSetModelAccessGroupBudget,
} from "@/app/(dashboard)/hooks/modelAccessGroups/useSetModelAccessGroupBudget";
import AccessGroupBudgetModal from "@/app/(dashboard)/models-and-endpoints/components/AccessGroupBudgetModal";
import { getAccessGroupBudgetColumns } from "@/app/(dashboard)/models-and-endpoints/components/AccessGroupBudgetColumns";

const DEFAULT_SORTING: SortingState = [{ id: "access_group", desc: false }];

function EmptyState() {
  const t = useTranslations("modelsEndpoints");
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-foreground">{t("noAccessGroupsTitle")}</div>
      <div className="text-sm text-muted-foreground">{t("noAccessGroupsHint")}</div>
    </div>
  );
}

export default function AccessGroupBudgetsPanel() {
  const t = useTranslations("modelsEndpoints");
  const { userRole } = useAuthorized();
  const { data: accessGroups, isLoading } = useModelAccessGroups();
  const setBudget = useSetModelAccessGroupBudget();
  const clearBudget = useDeleteModelAccessGroupBudget();

  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [editing, setEditing] = useState<ModelAccessGroup | null>(null);
  const [clearing, setClearing] = useState<ModelAccessGroup | null>(null);

  const canWrite = isProxyAdminRole(userRole ?? "");
  const columnDeps = useMemo(
    () => ({ canWrite, t, onSetBudget: setEditing, onClearBudget: setClearing }),
    [canWrite, t],
  );
  const columns = useMemo(() => getAccessGroupBudgetColumns(columnDeps), [columnDeps]);

  const handleSubmit = (params: SetModelAccessGroupBudgetParams) => {
    if (!editing) return;
    const accessGroup = editing.access_group;
    setBudget.mutate(
      { accessGroup, params },
      {
        onSuccess: () => {
          toast.success(t("budgetSavedToast", { group: accessGroup }));
          setEditing(null);
        },
      },
    );
  };

  const handleConfirmClear = () => {
    if (!clearing) return;
    const accessGroup = clearing.access_group;
    clearBudget.mutate(accessGroup, {
      onSuccess: () => {
        toast.success(t("budgetClearedToast", { group: accessGroup }));
        setClearing(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("panelDescription")}</p>

      <DataTable
        data={accessGroups ?? []}
        paginationMode="client"
        columns={columns}
        getRowId={(group) => group.access_group}
        sortingMode="client"
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={isLoading}
        loadingMessage={t("loadingAccessGroups")}
        noDataMessage={<EmptyState />}
        size="compact"
      />

      <AccessGroupBudgetModal
        accessGroup={editing}
        isSaving={setBudget.isPending}
        onCancel={() => setEditing(null)}
        onSubmit={handleSubmit}
      />

      <DeleteResourceModal
        isOpen={clearing !== null}
        title={t("clearBudget")}
        message={t("clearBudgetMessage")}
        resourceInformationTitle={t("colAccessGroup")}
        resourceInformation={[
          { label: t("colAccessGroup"), value: clearing?.access_group ?? null, code: true },
          { label: t("maxBudgetRow"), value: clearing?.budget?.max_budget?.toString() ?? null },
        ]}
        onCancel={() => setClearing(null)}
        onOk={handleConfirmClear}
        confirmLoading={clearBudget.isPending}
      />
    </div>
  );
}
