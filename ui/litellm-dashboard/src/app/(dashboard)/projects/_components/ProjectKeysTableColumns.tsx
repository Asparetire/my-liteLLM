"use client";

import { ColumnDef } from "@tanstack/react-table";

import type { Translator } from "./ProjectsTableColumns";

import DefaultProxyAdminTag from "@/components/common_components/DefaultProxyAdminTag";
import { KeyResponse } from "@/components/key_team_helpers/key_list";
import { CellTooltip, DateCell, IdentityCell } from "@/components/shared/table_cells";
import { keyDetailHref } from "@/utils/entityLinks";

function OwnerCell({ record }: { record: KeyResponse }) {
  const email = record.user?.user_email ?? record.user_id ?? null;
  if (!email) return <span className="text-sm">—</span>;
  return (
    <CellTooltip
      content={email}
      trigger={
        <span className="inline-flex max-w-60 truncate">
          <DefaultProxyAdminTag userId={email} />
        </span>
      }
    />
  );
}

export const getProjectKeysTableColumns = (t: Translator): ColumnDef<KeyResponse>[] => [
  {
    id: "key_alias",
    accessorKey: "key_alias",
    meta: { title: t("keyName") },
    header: t("keyName"),
    enableSorting: false,
    cell: ({ row }) => (
      <IdentityCell
        title={<span title={row.original.key_alias ?? undefined}>{row.original.key_alias || "—"}</span>}
        href={row.original.token ? keyDetailHref(row.original.token) : undefined}
        className="max-w-60"
      />
    ),
  },
  {
    id: "owner",
    meta: { title: t("owner") },
    header: t("owner"),
    enableSorting: false,
    cell: ({ row }) => <OwnerCell record={row.original} />,
  },
  {
    id: "created_at",
    accessorKey: "created_at",
    meta: { title: t("colCreated") },
    header: t("colCreated"),
    size: 130,
    enableSorting: false,
    cell: ({ row }) => <DateCell value={row.original.created_at} precision="date" />,
  },
  {
    id: "last_active",
    accessorKey: "last_active",
    meta: { title: t("lastActive") },
    header: t("lastActive"),
    size: 130,
    enableSorting: false,
    cell: ({ row }) => <DateCell value={row.original.last_active} precision="date" fallback={t("never")} />,
  },
];
