import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MCPToolsetsTab } from "./MCPToolsetsTab";
import * as networking from "@/components/networking";
import { useMCPToolsets } from "@/app/(dashboard)/hooks/mcpServers/useMCPToolsets";
import { useMCPServers } from "@/app/(dashboard)/hooks/mcpServers/useMCPServers";
import { MCPToolset } from "@/components/mcp_tools/types";

vi.mock("@/components/networking", () => ({
  createMCPToolset: vi.fn(),
  updateMCPToolset: vi.fn(),
  deleteMCPToolset: vi.fn(),
  listMCPTools: vi.fn(),
  getProxyBaseUrl: vi.fn().mockReturnValue("http://localhost:4000"),
}));

vi.mock("@/app/(dashboard)/hooks/mcpServers/useMCPToolsets", () => ({ useMCPToolsets: vi.fn() }));
vi.mock("@/app/(dashboard)/hooks/mcpServers/useMCPServers", () => ({ useMCPServers: vi.fn() }));

const setup = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const renderTab = (toolsets: MCPToolset[] = []) => {
  vi.mocked(useMCPToolsets).mockReturnValue({
    data: toolsets,
    isLoading: false,
  } as unknown as ReturnType<typeof useMCPToolsets>);
  vi.mocked(useMCPServers).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useMCPServers>);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MCPToolsetsTab accessToken="sk-test" userRole="Admin" />
    </QueryClientProvider>,
  );
};

const dialogWithButton = async (name: string) => {
  const button = await screen.findByRole("button", { name });
  const dialog = button.closest('[role="dialog"]');
  if (dialog === null) {
    throw new Error(`no dialog contains a "${name}" button`);
  }
  return within(dialog as HTMLElement);
};

const openEditFor = async (user: ReturnType<typeof setup>) => {
  await user.click(await screen.findByRole("button", { name: "打开工具集操作" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑" }));
  return dialogWithButton("保存更改");
};

const openCreate = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole("button", { name: "新建工具集" }));
  return dialogWithButton("创建工具集");
};

describe("MCPToolsetsTab create/edit toolset form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a toolset with the typed name, description and no tools", async () => {
    const user = setup();
    vi.mocked(networking.createMCPToolset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof networking.createMCPToolset>>,
    );
    renderTab();

    const dialog = await openCreate(user);
    fireEvent.change(dialog.getByPlaceholderText("e.g. github-linear-tools"), {
      target: { value: "github-linear-tools" },
    });
    fireEvent.change(dialog.getByPlaceholderText("可选描述"), { target: { value: "tools for triage" } });
    await user.click(dialog.getByRole("button", { name: "创建工具集" }));

    await waitFor(() => {
      expect(networking.createMCPToolset).toHaveBeenCalledWith("sk-test", {
        toolset_name: "github-linear-tools",
        description: "tools for triage",
        tools: [],
      });
    });
    expect(networking.createMCPToolset).toHaveBeenCalledTimes(1);
  });

  it("sends an empty string when the description is left untouched", async () => {
    const user = setup();
    vi.mocked(networking.createMCPToolset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof networking.createMCPToolset>>,
    );
    renderTab();

    const dialog = await openCreate(user);
    fireEvent.change(dialog.getByPlaceholderText("e.g. github-linear-tools"), { target: { value: "solo" } });
    await user.click(dialog.getByRole("button", { name: "创建工具集" }));

    await waitFor(() => {
      expect(networking.createMCPToolset).toHaveBeenCalledWith("sk-test", {
        toolset_name: "solo",
        description: "",
        tools: [],
      });
    });
  });

  it("blocks the submit and shows the required message when the name is empty", async () => {
    const user = setup();
    renderTab();

    const dialog = await openCreate(user);
    await user.click(dialog.getByRole("button", { name: "创建工具集" }));

    expect(await dialog.findByText("请输入工具集名称")).toBeInTheDocument();
    expect(networking.createMCPToolset).not.toHaveBeenCalled();
  });

  it("does not treat a whitespace-only description as absent", async () => {
    const user = setup();
    vi.mocked(networking.createMCPToolset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof networking.createMCPToolset>>,
    );
    renderTab();

    const dialog = await openCreate(user);
    fireEvent.change(dialog.getByPlaceholderText("e.g. github-linear-tools"), { target: { value: "spaced" } });
    fireEvent.change(dialog.getByPlaceholderText("可选描述"), { target: { value: "  " } });
    await user.click(dialog.getByRole("button", { name: "创建工具集" }));

    await waitFor(() => {
      expect(networking.createMCPToolset).toHaveBeenCalledWith("sk-test", {
        toolset_name: "spaced",
        description: "  ",
        tools: [],
      });
    });
  });

  it("seeds the edit form from the toolset and updates it by id", async () => {
    const user = setup();
    vi.mocked(networking.updateMCPToolset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof networking.updateMCPToolset>>,
    );
    const toolset = {
      toolset_id: "ts-1",
      toolset_name: "existing",
      description: "old description",
      tools: [{ server_id: "srv-1", tool_name: "search" }],
    } as MCPToolset;
    renderTab([toolset]);

    const dialog = await openEditFor(user);
    const name = await dialog.findByDisplayValue("existing");
    expect(name).toBe(dialog.getByPlaceholderText("e.g. github-linear-tools"));
    expect(dialog.getByText("工具集名称")).toBeInTheDocument();
    expect(dialog.getByPlaceholderText("可选描述")).toHaveValue("old description");

    await user.clear(name);
    fireEvent.change(name, { target: { value: "renamed" } });
    await user.click(dialog.getByRole("button", { name: "保存更改" }));

    const expectedUpdate = {
      toolset_id: "ts-1",
      toolset_name: "renamed",
      description: "old description",
      tools: [{ server_id: "srv-1", tool_name: "search" }],
    };
    await waitFor(() => {
      expect(networking.updateMCPToolset).toHaveBeenCalledWith("sk-test", expectedUpdate);
    });
  });

  it("seeds an absent description as an empty string rather than failing", async () => {
    const user = setup();
    vi.mocked(networking.updateMCPToolset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof networking.updateMCPToolset>>,
    );
    const toolset = {
      toolset_id: "ts-2",
      toolset_name: "no-desc",
      description: null,
      tools: [],
    } as unknown as MCPToolset;
    renderTab([toolset]);

    const dialog = await openEditFor(user);
    await dialog.findByDisplayValue("no-desc");
    expect(dialog.getByPlaceholderText("可选描述")).toHaveValue("");

    await user.click(dialog.getByRole("button", { name: "保存更改" }));

    const expectedUpdate = { toolset_id: "ts-2", toolset_name: "no-desc", description: "", tools: [] };
    await waitFor(() => {
      expect(networking.updateMCPToolset).toHaveBeenCalledWith("sk-test", expectedUpdate);
    });
  });
});
