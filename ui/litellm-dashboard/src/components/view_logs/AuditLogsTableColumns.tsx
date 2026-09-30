"use client";

import { ColumnDef } from "@tanstack/react-table";

import { DateCell, IdCell, IdentityCell, StatusBadge, type StatusTone } from "@/components/shared/table_cells";

import DefaultProxyAdminTag from "../common_components/DefaultProxyAdminTag";

export type AuditLogEntry = {
  id: string;
  updated_at: string;
  changed_by: string;
  changed_by_api_key: string;
  action: string;
  table_name: string;
  object_id: string;
  before_value: Record<string, unknown>;
  updated_values: Record<string, unknown>;
};

// 操作/表名显示：值是 logs 命名空间的键，消费组件用 t() 解析；未匹配时回退原始数据值
export const AUDIT_ACTION_LABEL_KEYS: Record<string, string> = {
  created: "auditActionCreated",
  updated: "auditActionUpdated",
  deleted: "auditActionDeleted",
  rotated: "auditActionRotated",
};

export const AUDIT_TABLE_NAME_KEYS: Record<string, string> = {
  LiteLLM_VerificationToken: "auditTableKeys",
  LiteLLM_TeamTable: "auditTableTeams",
  LiteLLM_UserTable: "auditTableUsers",
  LiteLLM_OrganizationTable: "auditTableOrganizations",
  LiteLLM_ProxyModelTable: "auditTableModels",
};

const ACTION_TONE: Record<string, StatusTone> = {
  created: "success",
  updated: "info",
  deleted: "error",
  rotated: "warning",
};

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

interface AuditLogsTableColumnsDeps {
  onViewLog: (log: AuditLogEntry) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export const getAuditLogsTableColumns = ({ onViewLog, t }: AuditLogsTableColumnsDeps): ColumnDef<AuditLogEntry>[] => [
  {
    id: "updated_at",
    accessorKey: "updated_at",
    header: t("colTimestamp"),
    size: 200,
    enableSorting: false,
    cell: ({ row }) => <DateCell value={row.original.updated_at} />,
  },
  {
    id: "action",
    accessorKey: "action",
    header: t("auditFilterAction"),
    size: 110,
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge
        tone={ACTION_TONE[row.original.action] ?? "neutral"}
        label={
          row.original.action in AUDIT_ACTION_LABEL_KEYS
            ? t(AUDIT_ACTION_LABEL_KEYS[row.original.action])
            : capitalize(row.original.action)
        }
      />
    ),
  },
  {
    id: "table_name",
    accessorKey: "table_name",
    header: t("auditFilterTable"),
    size: 130,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.table_name in AUDIT_TABLE_NAME_KEYS
          ? t(AUDIT_TABLE_NAME_KEYS[row.original.table_name])
          : row.original.table_name}
      </span>
    ),
  },
  {
    id: "object_id",
    accessorKey: "object_id",
    header: t("auditFilterObjectId"),
    minSize: 220,
    enableSorting: false,
    cell: ({ row }) => (
      <IdentityCell
        title={row.original.object_id}
        titleClassName="font-mono text-xs font-normal text-primary"
        className="max-w-72"
        onClick={() => onViewLog(row.original)}
      />
    ),
  },
  {
    id: "changed_by",
    accessorKey: "changed_by",
    header: t("auditFilterChangedBy"),
    size: 200,
    enableSorting: false,
    cell: ({ row }) => <DefaultProxyAdminTag userId={row.original.changed_by} />,
  },
  {
    id: "changed_by_api_key",
    accessorKey: "changed_by_api_key",
    header: t("colApiKeyHash"),
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <IdCell value={row.original.changed_by_api_key} variant="plain" />,
  },
];
