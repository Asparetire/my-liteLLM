import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/shared/DataTable";
import zhCN from "../../../messages/zh-CN.json";
import { getModelHubTableColumns, ModelHubData } from "./ModelHubTableColumns";

// Resolve through the real zh-CN messages so capability/status assertions pin the translated
// output, mirroring the global next-intl mock that component-level hooks resolve through.
const zhAiHub = (zhCN as { aiHub: Record<string, string> }).aiHub;
const t = ((key: string, values?: Record<string, string | number>) => {
  let message = zhAiHub[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.split(`{${name}}`).join(String(value));
  }
  return message;
}) as unknown as Parameters<typeof getModelHubTableColumns>[0]["t"];

const mockModel: ModelHubData = {
  model_group: "gpt-4o",
  providers: ["openai", "azure", "bedrock"],
  max_input_tokens: 128000,
  max_output_tokens: 16384,
  input_cost_per_token: 0.0000025,
  output_cost_per_token: 0.00001,
  mode: "chat",
  supports_parallel_function_calling: false,
  supports_vision: true,
  supports_function_calling: true,
  is_public_model_group: true,
};

function renderTable(data: ModelHubData[], onModelClick = vi.fn()) {
  render(
    <DataTable
      data={data}
      columns={getModelHubTableColumns({ onModelClick, t })}
      getRowId={(model, index) => model.model_group || String(index)}
      sortingMode="client"
      size="compact"
    />,
  );
  return onModelClick;
}

describe("getModelHubTableColumns", () => {
  it("renders the model row", () => {
    renderTable([mockModel]);
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
  });

  it("shows the first two providers and '+1' for overflow", () => {
    renderTable([mockModel]);
    expect(screen.getByText("openai")).toBeInTheDocument();
    expect(screen.getByText("azure")).toBeInTheDocument();
    expect(screen.queryByText("bedrock")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("formats token limits and per-million costs", () => {
    renderTable([mockModel]);
    expect(screen.getByText("128.0K / 16.4K")).toBeInTheDocument();
    expect(screen.getByText("$2.50")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
  });

  it("shows capability badges only for supported features", () => {
    renderTable([mockModel]);
    expect(screen.getByText("视觉")).toBeInTheDocument();
    expect(screen.getByText("函数调用")).toBeInTheDocument();
    expect(screen.queryByText("并行函数调用")).not.toBeInTheDocument();
  });

  it("shows the public status badge", () => {
    renderTable([mockModel]);
    expect(screen.getByText("是")).toBeInTheDocument();
    renderTable([{ ...mockModel, model_group: "private-model", is_public_model_group: false }]);
    expect(screen.getByText("否")).toBeInTheDocument();
  });

  it("opens the model details when the name is clicked", async () => {
    const user = userEvent.setup();
    const onModelClick = renderTable([mockModel]);
    await user.click(screen.getByRole("button", { name: "gpt-4o" }));
    expect(onModelClick).toHaveBeenCalledWith(mockModel);
  });

  it("opens the model details from the actions menu", async () => {
    const user = userEvent.setup();
    const onModelClick = renderTable([mockModel]);
    await user.click(screen.getByTestId("model-hub-actions-gpt-4o"));
    await user.click(await screen.findByTestId("model-hub-action-details"));
    expect(onModelClick).toHaveBeenCalledWith(mockModel);
  });

  it("copies the model name from the actions menu", async () => {
    const user = userEvent.setup();
    renderTable([mockModel]);
    await user.click(screen.getByTestId("model-hub-actions-gpt-4o"));
    await user.click(await screen.findByTestId("model-hub-action-copy"));
    expect(await window.navigator.clipboard.readText()).toBe("gpt-4o");
  });
});
