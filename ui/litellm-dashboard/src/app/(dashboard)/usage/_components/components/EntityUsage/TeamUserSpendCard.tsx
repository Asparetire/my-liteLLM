import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

import { teamSpendByUserCall } from "@/components/networking";
import { DataTable } from "@/components/shared/DataTable";
import { MoneyCell } from "@/components/shared/table_cells";
import { Button } from "@/components/ui/button";
import { Card as ShadcnCard, CardContent } from "@/components/ui/card";

import {
  buildTeamUserSpendCsv,
  downloadCsv,
  sortBySpendDesc,
  teamLabel,
  teamUserSpendCsvFileName,
  teamUserSpendRowId,
  userLabel,
  type TeamUserSpendRow,
} from "./teamUserSpend";

interface TeamUserSpendCardProps {
  accessToken: string | null;
  startTime: Date | null;
  endTime: Date | null;
  teamIds: string[];
}

const TeamUserSpendCard: React.FC<TeamUserSpendCardProps> = ({ accessToken, startTime, endTime, teamIds }) => {
  const t = useTranslations("usage");
  const hasTeams = teamIds.length > 0;

  const columns: ColumnDef<TeamUserSpendRow>[] = [
    { header: t("colTeam"), accessorFn: teamLabel, id: "team", cell: ({ row }) => teamLabel(row.original) },
    { header: t("colUser"), accessorFn: userLabel, id: "user", cell: ({ row }) => userLabel(row.original) },
    {
      header: t("colSpend"),
      accessorKey: "spend",
      meta: { numeric: true },
      cell: ({ row }) => <MoneyCell value={row.original.spend} decimals={4} />,
    },
    {
      header: t("colRequests"),
      accessorKey: "api_requests",
      meta: { numeric: true },
      cell: ({ row }) => row.original.api_requests.toLocaleString(),
    },
    {
      header: t("colSuccessful"),
      accessorKey: "successful_requests",
      meta: { numeric: true, className: "text-success" },
      cell: ({ row }) => row.original.successful_requests.toLocaleString(),
    },
    {
      header: t("colFailed"),
      accessorKey: "failed_requests",
      meta: { numeric: true, className: "text-destructive" },
      cell: ({ row }) => row.original.failed_requests.toLocaleString(),
    },
    {
      header: t("colTokens"),
      accessorKey: "total_tokens",
      meta: { numeric: true },
      cell: ({ row }) => row.original.total_tokens.toLocaleString(),
    },
  ];
  const { data, isLoading } = useQuery({
    queryKey: ["teamSpendByUser", startTime?.toISOString(), endTime?.toISOString(), teamIds],
    queryFn: () =>
      accessToken && startTime && endTime ? teamSpendByUserCall(accessToken, startTime, endTime, teamIds) : null,
    enabled: Boolean(accessToken && startTime && endTime) && hasTeams,
  });
  const rows = useMemo(() => sortBySpendDesc(data?.results ?? []), [data]);

  return (
    <ShadcnCard>
      <CardContent className="flex flex-col space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col space-y-2">
            <h3 className="text-lg font-medium text-foreground">{t("spendPerUserInTeam")}</h3>
            <p className="text-xs text-muted-foreground">{t("spendPerUserHint")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || rows.length === 0}
            onClick={() => data && downloadCsv(buildTeamUserSpendCsv(data), teamUserSpendCsvFileName(data))}
          >
            <Download />
            {t("downloadCsv")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={teamUserSpendRowId}
          isLoading={isLoading}
          maxBodyHeight={320}
          noDataMessage={teamIds.length === 0 ? t("selectTeamForSpend") : t("noUserSpend")}
          size="compact"
        />
      </CardContent>
    </ShadcnCard>
  );
};

export default TeamUserSpendCard;
