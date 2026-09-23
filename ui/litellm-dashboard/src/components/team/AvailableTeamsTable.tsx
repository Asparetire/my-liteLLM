"use client";

import { SortingState } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/DataTable";

import { AvailableTeam, getAvailableTeamsTableColumns } from "./AvailableTeamsTableColumns";

interface AvailableTeamsTableProps {
  teams: AvailableTeam[];
  isLoading: boolean;
  onJoinTeam: (teamId: string) => void;
}

const DEFAULT_SORTING: SortingState = [{ id: "team_alias", desc: false }];

function EmptyState() {
  const t = useTranslations("teamInfo");
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
        <Users className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-foreground">{t("noAvailableTeams")}</div>
      <div className="text-sm text-muted-foreground">
        {t("availableTeamsHint")}
        <a
          href="https://docs.litellm.ai/docs/proxy/self_serve#all-settings-for-self-serve--sso-flow"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          {t("docsLink")}
        </a>
      </div>
    </div>
  );
}

const AvailableTeamsTable: React.FC<AvailableTeamsTableProps> = ({ teams, isLoading, onJoinTeam }) => {
  const t = useTranslations("teamInfo");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const labels = useMemo(
    () => ({
      teamName: t("colTeamName"),
      description: t("colDescription"),
      noDescription: t("noDescription"),
      members: t("colMembers"),
      membersCount: (count: number) => t("membersCount", { count }),
      models: t("colModels"),
      actions: t("colActions"),
    }),
    [t],
  );

  const columns = useMemo(() => getAvailableTeamsTableColumns({ onJoinTeam, labels }), [onJoinTeam, labels]);

  return (
    <DataTable
      data={teams}
      paginationMode="client"
      columns={columns}
      getRowId={(team, index) => team.team_id || String(index)}
      sortingMode="client"
      sorting={sorting}
      onSortingChange={setSorting}
      isLoading={isLoading}
      loadingMessage={t("loadingAvailableTeams")}
      noDataMessage={<EmptyState />}
      size="compact"
    />
  );
};

export default AvailableTeamsTable;
