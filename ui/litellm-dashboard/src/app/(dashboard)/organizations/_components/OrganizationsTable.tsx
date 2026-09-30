"use client";

import { SortingState } from "@tanstack/react-table";
import { Building2, SearchX } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { Organization } from "@/components/networking";
import { useTranslations } from "next-intl";

import { getOrganizationsTableColumns } from "./OrganizationsTableColumns";

interface OrganizationsTableProps {
  organizations: Organization[];
  isLoading: boolean;
  userRole: string;
  searchActive: boolean;
  onOrganizationClick: (organizationId: string) => void;
  onEditClick: (organizationId: string) => void;
  onDeleteClick: (organizationId: string) => void;
}

const DEFAULT_SORTING: SortingState = [{ id: "created_at", desc: true }];

function EmptyState({ searchActive }: { searchActive: boolean }) {
  const t = useTranslations("organizations");
  const Icon = searchActive ? SearchX : Building2;
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-foreground">
        {searchActive ? t("emptyNoMatch") : t("emptyNone")}
      </div>
      <div className="text-sm text-muted-foreground">
        {searchActive ? t("emptyNoMatchHint") : t("emptyHint")}
      </div>
    </div>
  );
}

const OrganizationsTable: React.FC<OrganizationsTableProps> = ({
  organizations,
  isLoading,
  userRole,
  searchActive,
  onOrganizationClick,
  onEditClick,
  onDeleteClick,
}) => {
  const t = useTranslations("organizations");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const columns = useMemo(() => {
    const deps = { userRole, onOrganizationClick, onEditClick, onDeleteClick, t };
    return getOrganizationsTableColumns(deps);
  }, [userRole, onOrganizationClick, onEditClick, onDeleteClick, t]);

  return (
    <DataTable
      data={organizations}
      paginationMode="client"
      columns={columns}
      getRowId={(organization, index) => organization.organization_id || String(index)}
      sortingMode="client"
      sorting={sorting}
      onSortingChange={setSorting}
      isLoading={isLoading}
      loadingMessage={t("loading")}
      noDataMessage={<EmptyState searchActive={searchActive} />}
      size="compact"
    />
  );
};

export default OrganizationsTable;
