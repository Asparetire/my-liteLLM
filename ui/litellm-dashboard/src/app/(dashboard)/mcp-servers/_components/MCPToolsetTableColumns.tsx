"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Copy, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableSortHeader } from "@/components/shared/DataTable";
import { DateCell, IdCell, IdentityCell } from "@/components/shared/table_cells";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cva.config";
import { getProxyBaseUrl } from "@/components/networking";
import { MCPToolset } from "@/components/mcp_tools/types";
import { copyToClipboard } from "@/utils/dataUtils";

// Display-only. Toolsets persist {server_id, bare tool_name}; the gateway serves
// each tool prefixed as "{server-prefix}-{tool}". Render that qualified form so
// the same tool name on different servers stays distinguishable. This mirrors the
// backend default MCP_TOOL_PREFIX_SEPARATOR; overriding that env var only changes
// this cosmetic label, never what is stored or how tools are matched.
const MCP_TOOL_PREFIX_SEPARATOR = "-";

export function displayToolName(serverPrefix: string | undefined, toolName: string): string {
  return serverPrefix ? `${serverPrefix}${MCP_TOOL_PREFIX_SEPARATOR}${toolName}` : toolName;
}

export function toolsetEndpointUrl(toolsetName: string): string {
  return `${getProxyBaseUrl()}/toolset/${toolsetName}/mcp`;
}

interface ToolsetRowActionsProps {
  toolset: MCPToolset;
  isAdmin: boolean;
  onEditClick: (toolset: MCPToolset) => void;
  onDeleteClick: (toolsetId: string) => void;
}

function ToolsetRowActions({ toolset, isAdmin, onEditClick, onDeleteClick }: ToolsetRowActionsProps) {
  const t = useTranslations("mcpServers");
  const tCommon = useTranslations("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("tsActionsAria")}
        data-testid={`toolset-actions-${toolset.toolset_id}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          data-testid="toolset-action-copy-url"
          onClick={() => void copyToClipboard(toolsetEndpointUrl(toolset.toolset_name), t("tsEndpointCopied"))}
        >
          <Link2 />
          {t("tsCopyEndpoint")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="toolset-action-copy-id"
          onClick={() => void copyToClipboard(toolset.toolset_id, t("tsIdCopied"))}
        >
          <Copy />
          {t("tsCopyId")}
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="toolset-action-edit" onClick={() => onEditClick(toolset)}>
              <Pencil />
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              data-testid="toolset-action-delete"
              onClick={() => onDeleteClick(toolset.toolset_id)}
            >
              <Trash2 />
              {tCommon("delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

interface MCPToolsetTableColumnsDeps {
  t: Translator;
  tCommon: Translator;
  isAdmin: boolean;
  serverPrefixById: Map<string, string>;
  onEditClick: (toolset: MCPToolset) => void;
  onDeleteClick: (toolsetId: string) => void;
}

export const getMCPToolsetTableColumns = ({
  t,
  tCommon,
  isAdmin,
  serverPrefixById,
  onEditClick,
  onDeleteClick,
}: MCPToolsetTableColumnsDeps): ColumnDef<MCPToolset>[] => [
  {
    id: "toolset_id",
    accessorKey: "toolset_id",
    meta: { title: t("tsColToolsetId") },
    header: t("tsColToolsetId"),
    size: 140,
    enableSorting: false,
    cell: ({ row }) => <IdCell value={row.original.toolset_id} />,
  },
  {
    id: "toolset_name",
    accessorKey: "toolset_name",
    meta: { title: t("tsColName") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("tsColName")} />,
    size: 260,
    enableSorting: true,
    sortingFn: "alphanumeric",
    cell: ({ row }) => (
      <IdentityCell
        title={row.original.toolset_name}
        subtitle={toolsetEndpointUrl(row.original.toolset_name)}
        className="max-w-80"
        onClick={isAdmin ? () => onEditClick(row.original) : undefined}
      />
    ),
  },
  {
    id: "description",
    accessorKey: "description",
    meta: { title: t("tsColDescription") },
    header: t("tsColDescription"),
    size: 200,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="block max-w-72 truncate text-sm text-muted-foreground" title={row.original.description}>
        {row.original.description || "—"}
      </span>
    ),
  },
  {
    id: "tools",
    meta: { title: t("tsColTools"), skeleton: "chips" },
    header: t("tsColTools"),
    size: 260,
    enableSorting: false,
    cell: ({ row }) => {
      const tools = row.original.tools;
      return (
        <div className="flex max-w-xs flex-wrap gap-1">
          {tools.slice(0, 4).map((tool) => (
            <span
              key={`${tool.server_id}-${tool.tool_name}`}
              className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs"
            >
              {displayToolName(serverPrefixById.get(tool.server_id), tool.tool_name)}
            </span>
          ))}
          {tools.length > 4 && (
            <span className="self-center text-xs text-muted-foreground">{t("tsMoreTools", { count: tools.length - 4 })}</span>
          )}
        </div>
      );
    },
  },
  {
    id: "created_at",
    accessorKey: "created_at",
    meta: { title: t("tsColCreated") },
    header: ({ column }) => <DataTableSortHeader column={column} title={t("tsColCreated")} />,
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <DateCell value={row.original.created_at} precision="date" />,
  },
  {
    id: "actions",
    meta: { className: "text-right", headerClassName: "text-right" },
    header: () => <span className="sr-only">{t("tsColActions")}</span>,
    size: 64,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ToolsetRowActions
          toolset={row.original}
          isAdmin={isAdmin}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
        />
      </div>
    ),
  },
];
