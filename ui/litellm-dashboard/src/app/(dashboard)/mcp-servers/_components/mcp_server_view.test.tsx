import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPServerView } from "./mcp_server_view";
import type { MCPServer } from "@/components/mcp_tools/types";

vi.mock(".", () => ({
  MCPToolsViewer: () => <div>tools viewer</div>,
}));

vi.mock("./mcp_server_edit", () => ({
  default: () => <div>edit form</div>,
  EDIT_OAUTH_UI_STATE_KEY: "litellm-mcp-oauth-edit-state",
}));

const baseServer = {
  server_id: "srv-1",
  server_name: "demo server",
  alias: "demo_alias",
  description: "A demo MCP server",
  transport: "http",
  url: "https://example.com/mcp",
  auth_type: "api_key",
} as MCPServer;

const renderView = (overrides: Partial<MCPServer> = {}, props: Record<string, unknown> = {}) =>
  render(
    <MCPServerView
      mcpServer={{ ...baseServer, ...overrides } as MCPServer}
      onBack={vi.fn()}
      isProxyAdmin
      isEditing={false}
      accessToken="tok"
      userRole="Admin"
      userID="u1"
      availableAccessGroups={[]}
      {...props}
    />,
  );

describe("MCPServerView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Name, alias and description each label the header and a Settings row, so
  // only the server id is unique to the header.
  it("shows the server identity in the header", () => {
    renderView();

    expect(screen.getByText("srv-1")).toBeInTheDocument();
    expect(screen.getAllByText("demo server").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A demo MCP server").length).toBeGreaterThan(0);
    expect(screen.getAllByText("demo_alias").length).toBeGreaterThan(0);
  });

  it("falls back to a placeholder name when the server has neither name nor alias", () => {
    renderView({ server_name: undefined, alias: undefined });

    expect(screen.getByText("未命名服务器")).toBeInTheDocument();
  });

  // "Transport" and "Authentication" label both an Overview card and a Settings
  // row, so only Overview-exclusive labels identify the Overview panel.
  it("summarises the connection on the Overview tab", () => {
    renderView();

    expect(screen.getByText("主机 URL")).toBeInTheDocument();
    expect(screen.getByText("成本配置")).toBeInTheDocument();
    expect(screen.getAllByText("HTTP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("https://example.com/mcp").length).toBeGreaterThan(0);
  });

  it("offers a Settings tab to proxy admins only", () => {
    renderView();
    expect(screen.getByRole("tab", { name: "设置" })).toBeInTheDocument();
  });

  it("hides the Settings tab from non-admins", () => {
    renderView({}, { isProxyAdmin: false });
    expect(screen.queryByRole("tab", { name: "设置" })).not.toBeInTheDocument();
  });

  it("opens the tools viewer on the MCP Tools tab", async () => {
    renderView();

    await userEvent.click(screen.getByRole("tab", { name: "MCP 工具" }));

    expect(await screen.findByText("tools viewer")).toBeInTheDocument();
  });

  it("shows the read-only settings summary before editing", async () => {
    renderView({ allow_all_keys: true, available_on_public_internet: false });

    await userEvent.click(screen.getByRole("tab", { name: "设置" }));

    expect(await screen.findByText("MCP 服务器设置")).toBeInTheDocument();
    expect(screen.getByText("允许所有密钥")).toBeInTheDocument();
    expect(screen.getByText("已启用")).toBeInTheDocument();
    expect(screen.getByText("仅内部")).toBeInTheDocument();
    expect(screen.queryByText("edit form")).not.toBeInTheDocument();
  });

  it("swaps in the edit form when Edit Settings is pressed", async () => {
    renderView();

    await userEvent.click(screen.getByRole("tab", { name: "设置" }));
    await userEvent.click(await screen.findByRole("button", { name: "编辑设置" }));

    expect(await screen.findByText("edit form")).toBeInTheDocument();
  });

  it("opens straight into the edit form when isEditing is set", async () => {
    renderView({}, { isEditing: true });

    await userEvent.click(screen.getByRole("tab", { name: "设置" }));

    expect(await screen.findByText("edit form")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑设置" })).not.toBeInTheDocument();
  });

  it("opens on the tab named by initialTabIndex", async () => {
    renderView({}, { initialTabIndex: 1 });

    expect(await screen.findByText("tools viewer")).toBeInTheDocument();
  });

  it("returns to the server list when Back is pressed", async () => {
    const onBack = vi.fn();
    renderView({}, { onBack });

    await userEvent.click(screen.getByRole("button", { name: /返回全部服务器/ }));

    expect(onBack).toHaveBeenCalled();
  });

  it("lists the allowed tools, or says all tools are enabled", async () => {
    renderView({ allowed_tools: ["search", "fetch"] });
    await userEvent.click(screen.getByRole("tab", { name: "设置" }));

    expect(await screen.findByText("search")).toBeInTheDocument();
    expect(screen.getByText("fetch")).toBeInTheDocument();
    expect(screen.queryByText("允许所有工具")).not.toBeInTheDocument();
  });

  it("says all tools are enabled when no allowlist is stored", async () => {
    renderView({ allowed_tools: [] });
    await userEvent.click(screen.getByRole("tab", { name: "设置" }));

    expect(await screen.findByText("允许所有工具")).toBeInTheDocument();
  });
});
