"use client";

import { ColumnDef } from "@tanstack/react-table";

import { DataTableSortHeader } from "@/components/shared/DataTable";
import { CellTooltip, IdentityCell, StatusBadge, type StatusTone } from "@/components/shared/table_cells";
import { Badge } from "@/components/ui/badge";
import { getProviderLogoAndName } from "@/components/provider_info_helpers";
import { PUBLIC_MODEL_HUB_SORTABLE_FIELDS } from "@/components/publicModelHub/publicModelHubFilters";
import { capabilityLabel } from "@/components/AIHub/ModelHubTableColumns";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export interface ModelGroupInfo {
  model_group: string;
  providers: string[];
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  mode?: string;
  tpm?: number;
  rpm?: number;
  supports_parallel_function_calling: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supported_openai_params?: string[];
  health_status?: string;
  health_response_time?: number;
  health_checked_at?: string;
  [key: string]: any;
}

export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
  }>;
  iconUrl?: string;
  provider?: {
    organization: string;
    url: string;
  };
  documentationUrl?: string;
  [key: string]: any;
}

export interface MCPServerData {
  server_id: string;
  name: string;
  alias?: string | null;
  server_name: string;
  transport: string;
  spec_path?: string | null;
  auth_type: string;
  mcp_info: {
    server_name: string;
    description?: string;
    mcp_server_cost_info?: any;
  };
  [key: string]: any;
}

const formatCost = (cost: number) => `$${(cost * 1_000_000).toFixed(4)}`;

const formatTokens = (tokens: number | undefined, t: Translator) => {
  if (!tokens) return t("valueNa");
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return tokens.toString();
};

const formatLimits = (rpm: number | undefined, tpm: number | undefined, t: Translator) => {
  const limits = [...(rpm ? [`RPM: ${rpm.toLocaleString()}`] : []), ...(tpm ? [`TPM: ${tpm.toLocaleString()}`] : [])];
  return limits.length > 0 ? limits.join(", ") : t("valueNa");
};

const getModeIcon = (mode: string) => {
  switch (mode?.toLowerCase()) {
    case "chat":
      return "💬";
    case "rerank":
      return "🔄";
    case "embedding":
      return "📄";
    default:
      return "🤖";
  }
};

const HEALTH_TONES: Record<string, StatusTone> = {
  healthy: "success",
  unhealthy: "error",
};

function ProviderChips({ providers }: { providers: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {providers.map((provider) => {
        const { logo } = getProviderLogoAndName(provider);
        return (
          <span key={provider} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            {logo && (
              <img
                src={logo}
                alt={provider}
                className="size-3 shrink-0 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="capitalize">{provider}</span>
          </span>
        );
      })}
    </div>
  );
}

function OverflowChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-1">
      <Badge variant="secondary">{items[0]}</Badge>
      {items.length > 1 && (
        <CellTooltip
          content={
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item} className="text-xs">
                  • {item}
                </div>
              ))}
            </div>
          }
          trigger={<span className="cursor-default text-xs text-muted-foreground">+{items.length - 1}</span>}
        />
      )}
    </div>
  );
}

interface PublicModelHubColumnsDeps {
  onModelClick: (model: ModelGroupInfo) => void;
  t: Translator;
}

export const getPublicModelHubColumns = ({ onModelClick, t }: PublicModelHubColumnsDeps): ColumnDef<ModelGroupInfo>[] => {
  const columns: ColumnDef<ModelGroupInfo>[] = [
    {
      id: "model_group",
      accessorKey: "model_group",
      meta: { title: t("colPublicModelName") },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colPublicModelName")} />,
      size: 200,
      sortingFn: "alphanumeric",
      cell: ({ row }) => (
        <IdentityCell
          title={row.original.model_group}
          titleClassName="font-mono text-xs font-normal"
          className="max-w-72"
          onClick={() => onModelClick(row.original)}
        />
      ),
    },
    {
      id: "providers",
      accessorKey: "providers",
      meta: { title: t("colProviders"), skeleton: "chips" },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colProviders")} />,
      size: 150,
      sortingFn: (rowA, rowB) =>
        (rowA.original.providers ?? []).join(", ").localeCompare((rowB.original.providers ?? []).join(", ")),
      cell: ({ row }) => <ProviderChips providers={row.original.providers ?? []} />,
    },
    {
      id: "mode",
      accessorKey: "mode",
      meta: { title: t("colMode") },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colMode")} />,
      size: 110,
      sortingFn: "alphanumeric",
      cell: ({ row }) => (
        <span className="flex items-center gap-2 text-sm">
          <span>{getModeIcon(row.original.mode || "")}</span>
          <span>{row.original.mode || "Chat"}</span>
        </span>
      ),
    },
    {
      id: "max_input_tokens",
      accessorKey: "max_input_tokens",
      meta: { title: t("colMaxInput"), numeric: true },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colMaxInput")} />,
      size: 100,
      cell: ({ row }) => <span className="text-sm">{formatTokens(row.original.max_input_tokens, t)}</span>,
    },
    {
      id: "max_output_tokens",
      accessorKey: "max_output_tokens",
      meta: { title: t("colMaxOutput"), numeric: true },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colMaxOutput")} />,
      size: 100,
      cell: ({ row }) => <span className="text-sm">{formatTokens(row.original.max_output_tokens, t)}</span>,
    },
    {
      id: "input_cost_per_token",
      accessorKey: "input_cost_per_token",
      meta: { title: t("colInputCostPer1M"), numeric: true },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colInputCostPer1M")} />,
      size: 110,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.input_cost_per_token ? formatCost(row.original.input_cost_per_token) : t("valueFree")}
        </span>
      ),
    },
    {
      id: "output_cost_per_token",
      accessorKey: "output_cost_per_token",
      meta: { title: t("colOutputCostPer1M"), numeric: true },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colOutputCostPer1M")} />,
      size: 110,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.output_cost_per_token ? formatCost(row.original.output_cost_per_token) : t("valueFree")}
        </span>
      ),
    },
    {
      id: "features",
      meta: { title: t("colFeatures"), skeleton: "chips" },
      header: t("colFeatures"),
      size: 140,
      cell: ({ row }) => {
        const features = Object.entries(row.original)
          .filter(([key, value]) => key.startsWith("supports_") && value === true)
          .map(([key]) => capabilityLabel(key, t));
        return <OverflowChips items={features} />;
      },
    },
    {
      id: "health_status",
      accessorKey: "health_status",
      meta: { title: t("colHealthStatus"), skeleton: "badge" },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colHealthStatus")} />,
      size: 130,
      cell: ({ row }) => {
        const model = row.original;
        const responseTimeLabel = model.health_response_time
          ? t("responseTimeLabel", { time: Number(model.health_response_time).toFixed(2) })
          : t("valueNa");
        const lastCheckedLabel = model.health_checked_at
          ? t("lastCheckedLabel", { time: new Date(model.health_checked_at).toLocaleString() })
          : t("valueNa");
        return (
          <CellTooltip
            content={
              <>
                <div>{responseTimeLabel}</div>
                <div>{lastCheckedLabel}</div>
              </>
            }
            trigger={
              <span className="capitalize">
                <StatusBadge
                  tone={HEALTH_TONES[model.health_status ?? ""] || "neutral"}
                  label={model.health_status ?? "Unknown"}
                />
              </span>
            }
          />
        );
      },
    },
    {
      id: "rpm",
      accessorKey: "rpm",
      meta: { title: t("colLimits") },
      header: ({ column }) => <DataTableSortHeader column={column} title={t("colLimits")} />,
      size: 150,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatLimits(row.original.rpm, row.original.tpm, t)}</span>
      ),
    },
  ];
  return columns.map((column) => ({
    ...column,
    enableSorting: PUBLIC_MODEL_HUB_SORTABLE_FIELDS.includes(String(column.id)),
  }));
};

interface PublicAgentHubColumnsDeps {
  onAgentClick: (agent: AgentCard) => void;
  t: Translator;
}

export const getPublicAgentHubColumns = ({ onAgentClick, t }: PublicAgentHubColumnsDeps): ColumnDef<AgentCard>[] => [
  {
    id: "name",
    accessorKey: "name",
    meta: { title: t("colAgentName") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colAgentName")} />,
    size: 200,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => (
      <IdentityCell
        title={row.original.name}
        titleClassName="font-mono text-xs font-normal"
        className="max-w-72"
        onClick={() => onAgentClick(row.original)}
      />
    ),
  },
  {
    id: "description",
    accessorKey: "description",
    meta: { title: t("colDescription") },
    header: t("colDescription"),
    size: 260,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="block max-w-72 truncate text-sm" title={row.original.description || undefined}>
        {row.original.description || "-"}
      </span>
    ),
  },
  {
    id: "version",
    accessorKey: "version",
    meta: { title: t("colVersion") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colVersion")} />,
    size: 90,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => <span className="text-sm">{row.original.version}</span>,
  },
  {
    id: "provider",
    meta: { title: t("colProvider") },
    header: t("colProvider"),
    size: 130,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.provider ? (
        <span className="text-sm font-medium">{row.original.provider.organization}</span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    id: "skills",
    meta: { title: t("colSkills"), skeleton: "chips" },
    header: t("colSkills"),
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <OverflowChips items={(row.original.skills || []).map((skill) => skill.name)} />,
  },
  {
    id: "capabilities",
    meta: { title: t("colCapabilities"), skeleton: "chips" },
    header: t("colCapabilities"),
    size: 160,
    enableSorting: false,
    cell: ({ row }) => {
      const capabilityList = Object.entries(row.original.capabilities || {})
        .filter(([, value]) => value === true)
        .map(([key]) => key);
      if (capabilityList.length === 0) {
        return <span className="text-xs text-muted-foreground">-</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {capabilityList.map((capability) => (
            <Badge key={capability} variant="outline" className="capitalize">
              {capability}
            </Badge>
          ))}
        </div>
      );
    },
  },
];

interface PublicMCPHubColumnsDeps {
  onServerClick: (server: MCPServerData) => void;
  t: Translator;
}

export const getPublicMCPHubColumns = ({ onServerClick, t }: PublicMCPHubColumnsDeps): ColumnDef<MCPServerData>[] => [
  {
    id: "server_name",
    accessorKey: "server_name",
    meta: { title: t("colServerName") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colServerName")} />,
    size: 180,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => (
      <IdentityCell
        title={row.original.server_name}
        titleClassName="font-mono text-xs font-normal"
        className="max-w-72"
        onClick={() => onServerClick(row.original)}
      />
    ),
  },
  {
    id: "description",
    meta: { title: t("colDescription") },
    header: t("colDescription"),
    size: 260,
    enableSorting: false,
    cell: ({ row }) => {
      const description = String(row.original.mcp_info?.description ?? "-");
      return (
        <span className="block max-w-72 truncate text-sm" title={description}>
          {description}
        </span>
      );
    },
  },
  {
    id: "transport",
    accessorKey: "transport",
    meta: { title: t("colTransport"), skeleton: "badge" },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colTransport")} />,
    size: 110,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-mono font-normal uppercase">
        {row.original.transport}
      </Badge>
    ),
  },
  {
    id: "auth_type",
    accessorKey: "auth_type",
    meta: { title: t("colAuthType"), skeleton: "badge" },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("colAuthType")} />,
    size: 110,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => (
      <StatusBadge tone={row.original.auth_type === "none" ? "neutral" : "success"} label={row.original.auth_type} />
    ),
  },
];
