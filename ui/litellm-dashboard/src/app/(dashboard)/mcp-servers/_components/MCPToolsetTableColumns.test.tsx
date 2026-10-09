import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/shared/DataTable";
import zhCN from "../../../../../messages/zh-CN.json";
import { MCPToolset } from "@/components/mcp_tools/types";
import { getMCPToolsetTableColumns } from "./MCPToolsetTableColumns";

vi.mock("@/components/networking", () => ({
  getProxyBaseUrl: () => "http://localhost:4000",
}));

// Resolve through the real zh-CN messages so column header/count assertions pin the
// translated output, mirroring the deps-injected translator the production caller passes.
const zhMcpServers = (zhCN as { mcpServers: Record<string, string> }).mcpServers;
const zhCommon = (zhCN as { common: Record<string, string> }).common;
const makeTranslator = (dict: Record<string, string>) =>
  ((key: string, values?: Record<string, string | number>) => {
    let message = dict[key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.split(`{${name}}`).join(String(value));
    }
    return message;
  }) as unknown as Parameters<typeof getMCPToolsetTableColumns>[0]["t"];

const mockToolset: MCPToolset = {
  toolset_id: "ts-1",
  toolset_name: "github-tools",
  description: "GitHub helpers",
  tools: [
    { server_id: "srv-1", tool_name: "create_issue" },
    { server_id: "srv-1", tool_name: "list_issues" },
    { server_id: "srv-2", tool_name: "search" },
    { server_id: "srv-2", tool_name: "fetch" },
    { server_id: "srv-2", tool_name: "crawl" },
  ],
  created_at: "2026-01-01T00:00:00Z",
};

const serverPrefixById = new Map([
  ["srv-1", "github"],
  ["srv-2", "exa"],
]);

function renderTable({ isAdmin = true, onEditClick = vi.fn(), onDeleteClick = vi.fn() } = {}) {
  const deps = {
    t: makeTranslator(zhMcpServers),
    tCommon: makeTranslator(zhCommon),
    isAdmin,
    serverPrefixById,
    onEditClick,
    onDeleteClick,
  };
  render(
    <DataTable
      data={[mockToolset]}
      columns={getMCPToolsetTableColumns(deps)}
      getRowId={(toolset) => toolset.toolset_id}
      sortingMode="client"
      size="compact"
    />,
  );
  return { onEditClick, onDeleteClick };
}

describe("getMCPToolsetTableColumns", () => {
  it("renders the toolset with its endpoint url as subtitle", () => {
    renderTable();
    expect(screen.getByText("github-tools")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:4000/toolset/github-tools/mcp")).toBeInTheDocument();
  });

  it("renders server-prefixed tool chips capped at four with an overflow count", () => {
    renderTable();
    expect(screen.getByText("github-create_issue")).toBeInTheDocument();
    expect(screen.getByText("github-list_issues")).toBeInTheDocument();
    expect(screen.getByText("exa-search")).toBeInTheDocument();
    expect(screen.getByText("exa-fetch")).toBeInTheDocument();
    expect(screen.queryByText("exa-crawl")).not.toBeInTheDocument();
    expect(screen.getByText("+1 个")).toBeInTheDocument();
  });

  it("opens the edit modal when an admin clicks the toolset name", async () => {
    const user = userEvent.setup();
    const { onEditClick } = renderTable();
    await user.click(screen.getByRole("button", { name: /github-tools/ }));
    expect(onEditClick).toHaveBeenCalledWith(mockToolset);
  });

  it("does not make the name clickable for non-admins", () => {
    renderTable({ isAdmin: false });
    expect(screen.queryByRole("button", { name: /github-tools/ })).not.toBeInTheDocument();
  });

  it("copies the endpoint url and toolset id from the actions menu", async () => {
    const user = userEvent.setup();
    renderTable({ isAdmin: false });

    await user.click(screen.getByTestId("toolset-actions-ts-1"));
    await user.click(await screen.findByTestId("toolset-action-copy-url"));
    expect(await window.navigator.clipboard.readText()).toBe("http://localhost:4000/toolset/github-tools/mcp");

    await user.click(screen.getByTestId("toolset-actions-ts-1"));
    await user.click(await screen.findByTestId("toolset-action-copy-id"));
    expect(await window.navigator.clipboard.readText()).toBe("ts-1");
  });

  it("edits and deletes through the actions menu as admin", async () => {
    const user = userEvent.setup();
    const { onEditClick, onDeleteClick } = renderTable();

    await user.click(screen.getByTestId("toolset-actions-ts-1"));
    await user.click(await screen.findByTestId("toolset-action-edit"));
    expect(onEditClick).toHaveBeenCalledWith(mockToolset);

    await user.click(screen.getByTestId("toolset-actions-ts-1"));
    await user.click(await screen.findByTestId("toolset-action-delete"));
    expect(onDeleteClick).toHaveBeenCalledWith("ts-1");
  });

  it("hides edit and delete from non-admins but keeps the copy actions", async () => {
    const user = userEvent.setup();
    renderTable({ isAdmin: false });

    await user.click(screen.getByTestId("toolset-actions-ts-1"));
    expect(await screen.findByTestId("toolset-action-copy-url")).toBeInTheDocument();
    expect(screen.getByTestId("toolset-action-copy-id")).toBeInTheDocument();
    expect(screen.queryByTestId("toolset-action-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolset-action-delete")).not.toBeInTheDocument();
  });
});
