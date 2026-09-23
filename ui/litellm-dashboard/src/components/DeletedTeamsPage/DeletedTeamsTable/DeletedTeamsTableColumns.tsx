"use client";

import { ColumnDef } from "@tanstack/react-table";

import { DataTableSortHeader } from "@/components/shared/DataTable";
import { DateCell, IdCell, IdentityCell, ModelsCell, MoneyCell } from "@/components/shared/table_cells";
import { DeletedTeam } from "@/app/(dashboard)/hooks/teams/useTeams";
import { orgDetailHref, userDetailHref } from "@/utils/entityLinks";

type Translator = (key: string, values?: Record<string, string | number>) => string;

function EntityCell({ value, href }: { value: string | null | undefined; href: string | undefined }) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="block max-w-60" title={value}>
      <IdentityCell title={value} titleClassName="font-normal" href={href} />
    </span>
  );
}

export const getDeletedTeamsTableColumns = (t: Translator): ColumnDef<DeletedTeam>[] => [
  {
    id: "team_alias",
    accessorKey: "team_alias",
    meta: { title: t("colTeamName") },
    header: t("colTeamName"),
    size: 150,
    enableSorting: false,
    cell: ({ row }) => {
      const value = row.original.team_alias;
      if (!value) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <span className="block max-w-60 truncate font-medium" title={value}>
          {value}
        </span>
      );
    },
  },
  {
    id: "team_id",
    accessorKey: "team_id",
    meta: { title: t("colTeamId") },
    header: t("colTeamId"),
    size: 150,
    enableSorting: false,
    cell: ({ row }) => <IdCell value={row.original.team_id} variant="plain" />,
  },
  {
    id: "created_at",
    accessorKey: "created_at",
    meta: { title: t("colCreated") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colCreated")} />,
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <DateCell value={row.original.created_at} precision="date" />,
  },
  {
    id: "spend",
    accessorKey: "spend",
    meta: { title: t("colSpend"), numeric: true },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colSpend")} />,
    size: 100,
    enableSorting: true,
    cell: ({ row }) => <MoneyCell value={row.original.spend} decimals={4} />,
  },
  {
    id: "max_budget",
    accessorKey: "max_budget",
    meta: { title: t("colBudget"), numeric: true },
    header: t("colBudget"),
    size: 110,
    enableSorting: false,
    cell: ({ row }) => <MoneyCell value={row.original.max_budget} decimals={0} emptyText="Unlimited" showZero />,
  },
  {
    id: "models",
    accessorKey: "models",
    meta: { title: t("colModels"), skeleton: "chips" },
    header: t("colModels"),
    size: 200,
    enableSorting: false,
    cell: ({ row }) => <ModelsCell models={row.original.models} />,
  },
  {
    id: "organization_id",
    accessorKey: "organization_id",
    meta: { title: t("colOrganization") },
    header: t("colOrganization"),
    size: 150,
    enableSorting: false,
    cell: ({ row }) => {
      const orgId = row.original.organization_id;
      return <EntityCell value={orgId} href={orgId ? orgDetailHref(orgId) : undefined} />;
    },
  },
  {
    id: "deleted_at",
    accessorKey: "deleted_at",
    meta: { title: t("colDeletedAt") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colDeletedAt")} />,
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <DateCell value={row.original.deleted_at} precision="date" />,
  },
  {
    id: "deleted_by",
    accessorKey: "deleted_by",
    meta: { title: t("colDeletedBy") },
    header: t("colDeletedBy"),
    size: 120,
    enableSorting: false,
    cell: ({ row }) => {
      const deletedBy = row.original.deleted_by;
      return <EntityCell value={deletedBy} href={deletedBy ? userDetailHref(deletedBy) : undefined} />;
    },
  },
];
