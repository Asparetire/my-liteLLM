"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { GitBranch, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableSortHeader } from "@/components/shared/DataTable";
import { IdentityCell, ModelsCell } from "@/components/shared/table_cells";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cva.config";

import { localizedStrategyLabel } from "./strategy";
import type { RoutingGroup } from "./types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

interface RoutingGroupRowActionsProps {
  group: RoutingGroup;
  onEdit: (group: RoutingGroup) => void;
  onDelete: (group: RoutingGroup) => void;
}

function RoutingGroupRowActions({ group, onEdit, onDelete }: RoutingGroupRowActionsProps) {
  const t = useTranslations("routerSettings");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("openActionsFor", { name: group.group_name })}
        data-testid={`routing-group-actions-${group.group_name}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem data-testid="routing-group-action-edit" onClick={() => onEdit(group)}>
          <Pencil />
          {t("actionEdit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          data-testid="routing-group-action-delete"
          onClick={() => onDelete(group)}
        >
          <Trash2 />
          {t("actionDelete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface RoutingGroupsTableColumnsDeps {
  onEdit: (group: RoutingGroup) => void;
  onDelete: (group: RoutingGroup) => void;
  onToggleUsage: (group: RoutingGroup) => void;
  t: Translator;
}

export const getRoutingGroupsTableColumns = ({
  onEdit,
  onDelete,
  onToggleUsage,
  t,
}: RoutingGroupsTableColumnsDeps): ColumnDef<RoutingGroup>[] => [
  {
    id: "group_name",
    accessorKey: "group_name",
    meta: { title: t("colGroupName"), skeleton: "text" },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colGroupName")} />,
    size: 240,
    enableSorting: true,
    cell: ({ row }) => (
      <IdentityCell title={row.original.group_name} className="max-w-60" onClick={() => onToggleUsage(row.original)} />
    ),
  },
  {
    id: "models",
    meta: { title: t("colModels"), skeleton: "chips" },
    header: t("colModels"),
    size: 320,
    enableSorting: false,
    cell: ({ row }) => <ModelsCell models={row.original.models} />,
  },
  {
    id: "routing_strategy",
    accessorKey: "routing_strategy",
    meta: { title: t("colStrategy"), skeleton: "text" },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colStrategy")} />,
    size: 180,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 text-sm">
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        {localizedStrategyLabel(row.original.routing_strategy, t)}
      </span>
    ),
  },
  {
    id: "actions",
    meta: { className: "text-right", headerClassName: "text-right" },
    header: () => <span className="sr-only">{t("actionsSr")}</span>,
    size: 64,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RoutingGroupRowActions group={row.original} onEdit={onEdit} onDelete={onDelete} />
      </div>
    ),
  },
];
