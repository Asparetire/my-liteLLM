"use client";

import { ColumnFiltersState, OnChangeFn, PaginationState } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  DataTable,
  DataTableFilterDrawer,
  DataTableFilterField,
  DataTableToolbar,
} from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  AUDIT_ACTION_LABEL_KEYS,
  AUDIT_TABLE_NAME_KEYS,
  AuditLogEntry,
  getAuditLogsTableColumns,
} from "./AuditLogsTableColumns";

interface AuditLogsTableProps {
  data: AuditLogEntry[];
  rowCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onRefresh: () => void;
  onViewLog: (log: AuditLogEntry) => void;
}

const ALL_VALUE = "all";

const ACTION_OPTIONS = [
  { labelKey: "auditActionCreated", value: "created" },
  { labelKey: "auditActionUpdated", value: "updated" },
  { labelKey: "auditActionDeleted", value: "deleted" },
  { labelKey: "auditActionRotated", value: "rotated" },
] as const;

const TABLE_OPTIONS = [
  { labelKey: "auditTableKeys", value: "LiteLLM_VerificationToken" },
  { labelKey: "auditTableTeams", value: "LiteLLM_TeamTable" },
  { labelKey: "auditTableUsers", value: "LiteLLM_UserTable" },
  { labelKey: "auditTableOrganizations", value: "LiteLLM_OrganizationTable" },
  { labelKey: "auditTableModels", value: "LiteLLM_ProxyModelTable" },
] as const;

const FILTER_LABEL_KEYS: Record<string, string> = {
  object_id: "auditFilterObjectId",
  changed_by: "auditFilterChangedBy",
  team_id: "filterTeamId",
  key_hash: "filterKeyHash",
  action: "auditFilterAction",
  table_name: "auditFilterTable",
};

function AuditLogsEmptyState({ filtered }: { filtered: boolean }) {
  const t = useTranslations("logs");
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
        <ScrollText className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-foreground">
        {filtered ? t("noMatchingAuditLogs") : t("noAuditLogsYet")}
      </div>
      <div className="max-w-xs text-center text-sm text-muted-foreground">
        {filtered
          ? t("noAuditLogsMatchFilters")
          : t("auditLogsWillAppear")}
      </div>
    </div>
  );
}

export function AuditLogsTable({
  data,
  rowCount,
  isLoading,
  isRefreshing,
  pagination,
  onPaginationChange,
  columnFilters,
  onColumnFiltersChange,
  searchValue,
  onSearchChange,
  onRefresh,
  onViewLog,
}: AuditLogsTableProps) {
  const t = useTranslations("logs");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const columns = useMemo(() => getAuditLogsTableColumns({ onViewLog, t }), [onViewLog, t]);
  const hasActiveSearch = Boolean(searchValue?.trim());

  const actionFilterItems = [
    { value: ALL_VALUE, label: t("auditAllActions") },
    ...ACTION_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
  ];
  const tableFilterItems = [
    { value: ALL_VALUE, label: t("auditAllTables") },
    ...TABLE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
  ];
  const filterLabels = Object.fromEntries(
    Object.entries(FILTER_LABEL_KEYS).map(([id, key]) => [id, t(key)]),
  );

  const formatFilterValue = (columnId: string, value: unknown): string => {
    const raw = String(value);
    if (columnId === "action") {
      return raw in AUDIT_ACTION_LABEL_KEYS ? t(AUDIT_ACTION_LABEL_KEYS[raw]) : raw;
    }
    if (columnId === "table_name") {
      return raw in AUDIT_TABLE_NAME_KEYS ? t(AUDIT_TABLE_NAME_KEYS[raw]) : raw;
    }
    return raw;
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      paginationMode="server"
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      rowCount={rowCount}
      filterMode="server"
      columnFilters={columnFilters}
      onColumnFiltersChange={onColumnFiltersChange}
      isLoading={isLoading}
      loadingMessage={t("loadingAuditLogs")}
      noDataMessage={<AuditLogsEmptyState filtered={columnFilters.length > 0 || hasActiveSearch} />}
      size="compact"
      toolbar={(table) => (
        <>
          <DataTableToolbar
            table={table}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            searchPlaceholder={t("searchAuditLogsById")}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onOpenFilters={() => setFiltersOpen(true)}
            filterLabels={filterLabels}
            formatFilterValue={formatFilterValue}
            showViewOptions={false}
          />
          <DataTableFilterDrawer
            table={table}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            title={t("filters")}
            description={t("narrowDownAuditLogs")}
          >
            {({ get, set }) => (
              <>
                <DataTableFilterField label={t("auditFilterObjectId")}>
                  <Input
                    value={(get("object_id") as string) ?? ""}
                    onChange={(event) => set("object_id", event.target.value)}
                    placeholder={t("auditEnterObjectId")}
                  />
                </DataTableFilterField>
                <DataTableFilterField label={t("auditFilterChangedBy")}>
                  <Input
                    value={(get("changed_by") as string) ?? ""}
                    onChange={(event) => set("changed_by", event.target.value)}
                    placeholder={t("auditEnterUserId")}
                  />
                </DataTableFilterField>
                <DataTableFilterField label={t("filterTeamId")}>
                  <Input
                    value={(get("team_id") as string) ?? ""}
                    onChange={(event) => set("team_id", event.target.value)}
                    placeholder={t("auditEnterTeamId")}
                  />
                </DataTableFilterField>
                <DataTableFilterField label={t("filterKeyHash")}>
                  <Input
                    value={(get("key_hash") as string) ?? ""}
                    onChange={(event) => set("key_hash", event.target.value)}
                    placeholder={t("enterKeyHash")}
                  />
                </DataTableFilterField>
                <DataTableFilterField label={t("auditFilterAction")}>
                  <Select
                    items={actionFilterItems}
                    value={(get("action") as string) ?? ALL_VALUE}
                    onValueChange={(value) => set("action", value === ALL_VALUE ? undefined : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("auditAllActions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>{t("auditAllActions")}</SelectItem>
                      {ACTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataTableFilterField>
                <DataTableFilterField label={t("auditFilterTable")}>
                  <Select
                    items={tableFilterItems}
                    value={(get("table_name") as string) ?? ALL_VALUE}
                    onValueChange={(value) => set("table_name", value === ALL_VALUE ? undefined : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("auditAllTables")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>{t("auditAllTables")}</SelectItem>
                      {TABLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DataTableFilterField>
              </>
            )}
          </DataTableFilterDrawer>
        </>
      )}
    />
  );
}
