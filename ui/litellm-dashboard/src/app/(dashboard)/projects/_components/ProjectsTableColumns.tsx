"use client";

import { ColumnDef } from "@tanstack/react-table";
import { LayersIcon } from "lucide-react";

import { ProjectResponse } from "@/app/(dashboard)/hooks/projects/useProjects";
import { DataTableSortHeader } from "@/components/shared/DataTable";
import { CellTooltip, DateCell, IdentityCell, StatusBadge } from "@/components/shared/table_cells";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Translator shape matches next-intl's t returned by useTranslations("projects").
export type Translator = (key: string, values?: Record<string, string | number>) => string;

interface ProjectsTableColumnsDeps {
  onProjectClick: (projectId: string) => void;
  teamAliasMap: Map<string, string>;
  isTeamsLoading: boolean;
  t: Translator;
}

function ProjectModelsCell({ project, t }: { project: ProjectResponse; t: Translator }) {
  const models = project.models ?? [];
  return (
    <CellTooltip
      content={models.length > 0 ? models.join(", ") : t("noModels")}
      trigger={
        <Badge variant="outline" className="cursor-default gap-1.5 font-normal">
          <LayersIcon className="size-3.5" />
          {models.length}
        </Badge>
      }
    />
  );
}

function ProjectTeamCell({
  project,
  teamAliasMap,
  isTeamsLoading,
}: {
  project: ProjectResponse;
  teamAliasMap: Map<string, string>;
  isTeamsLoading: boolean;
}) {
  if (!project.team_id) return <span className="text-sm">—</span>;
  const alias = teamAliasMap.get(project.team_id);
  if (alias) {
    return (
      <span className="block max-w-60 truncate text-sm" title={alias}>
        {alias}
      </span>
    );
  }
  if (isTeamsLoading) return <Skeleton className="h-3.5 w-24" />;
  return (
    <span className="block max-w-60 truncate font-mono text-xs" title={project.team_id}>
      {project.team_id}
    </span>
  );
}

export const getProjectsTableColumns = ({
  onProjectClick,
  teamAliasMap,
  isTeamsLoading,
  t,
}: ProjectsTableColumnsDeps): ColumnDef<ProjectResponse>[] => [
  {
    id: "project_id",
    accessorKey: "project_id",
    meta: { title: "ID" },
    header: "ID",
    size: 190,
    enableSorting: false,
    cell: ({ row }) => (
      <IdentityCell
        title={row.original.project_id}
        titleClassName="font-mono text-xs font-normal"
        onClick={() => onProjectClick(row.original.project_id)}
      />
    ),
  },
  {
    id: "project_alias",
    accessorFn: (row) => row.project_alias ?? "",
    meta: { title: t("colName") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colName")} />,
    size: 200,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block max-w-60 truncate text-sm font-medium" title={row.original.project_alias ?? undefined}>
        {row.original.project_alias ?? "—"}
      </span>
    ),
  },
  {
    id: "team",
    accessorFn: (row) => teamAliasMap.get(row.team_id ?? "") ?? "",
    meta: { title: t("colTeam") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colTeam")} />,
    size: 180,
    enableSorting: true,
    cell: ({ row }) => (
      <ProjectTeamCell project={row.original} teamAliasMap={teamAliasMap} isTeamsLoading={isTeamsLoading} />
    ),
  },
  {
    id: "models",
    meta: { title: t("colModels"), skeleton: "badge" },
    header: t("colModels"),
    size: 110,
    enableSorting: false,
    cell: ({ row }) => <ProjectModelsCell project={row.original} t={t} />,
  },
  {
    id: "status",
    accessorKey: "blocked",
    meta: { title: t("colStatus"), skeleton: "badge" },
    header: t("colStatus"),
    size: 110,
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge
        tone={row.original.blocked ? "error" : "success"}
        label={row.original.blocked ? t("statusBlocked") : t("statusActive")}
      />
    ),
  },
  {
    id: "created_at",
    accessorKey: "created_at",
    sortingFn: "datetime",
    meta: { title: t("colCreated") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colCreated")} />,
    size: 140,
    enableSorting: true,
    cell: ({ row }) => <DateCell value={row.original.created_at} precision="date" />,
  },
  {
    id: "updated_at",
    accessorKey: "updated_at",
    meta: { title: t("colUpdated") },
    header: t("colUpdated"),
    size: 140,
    enableSorting: false,
    cell: ({ row }) => <DateCell value={row.original.updated_at} precision="date" />,
  },
];
