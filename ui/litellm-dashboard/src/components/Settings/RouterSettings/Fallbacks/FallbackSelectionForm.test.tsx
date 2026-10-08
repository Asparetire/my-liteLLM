import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackSelectionForm } from "./FallbackSelectionForm";
import type { FallbackGroup } from "./FallbackGroupConfig";
import { toast } from "@/lib/toast";

const mockOnGroupsChange = vi.fn();
const AVAILABLE_MODELS = ["gpt-4", "gpt-3.5-turbo", "claude-3-opus"];

describe("FallbackSelectionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1234567890);
  });

  it("should render the component", () => {
    render(
      <FallbackSelectionForm groups={[]} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByText(/尚未配置降级组/)).toBeInTheDocument();
  });

  it("should show Create First Group button when no groups exist", () => {
    render(
      <FallbackSelectionForm groups={[]} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByRole("button", { name: /创建第一个组/ })).toBeInTheDocument();
  });

  it("should call onGroupsChange when Create First Group is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FallbackSelectionForm groups={[]} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );

    await user.click(screen.getByRole("button", { name: /创建第一个组/ }));

    expect(mockOnGroupsChange).toHaveBeenCalledTimes(1);
    const [newGroups] = mockOnGroupsChange.mock.calls[0];
    expect(newGroups).toHaveLength(1);
    expect(newGroups[0]).toEqual({
      id: "1234567890",
      primaryModel: null,
      fallbackModels: [],
    });
  });

  it("should display tabs when groups exist", () => {
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: null, fallbackModels: [] }];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByRole("tab", { name: /组 1/ })).toBeInTheDocument();
  });

  it("should display primary model as tab label when set", () => {
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: "gpt-4", fallbackModels: [] }];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByRole("tab", { name: "gpt-4" })).toBeInTheDocument();
  });

  it("should call onGroupsChange when add tab button is clicked", async () => {
    const user = userEvent.setup();
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: null, fallbackModels: [] }];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );

    const addTabButton = screen.getByRole("button", { name: /添加降级组/ });
    await user.click(addTabButton);

    expect(mockOnGroupsChange).toHaveBeenCalledTimes(1);
    const [newGroups] = mockOnGroupsChange.mock.calls[0];
    expect(newGroups).toHaveLength(2);
    expect(newGroups[1]).toEqual({
      id: "1234567890",
      primaryModel: null,
      fallbackModels: [],
    });
  });

  it("should not show add tab button when maxGroups is reached", () => {
    const groups: FallbackGroup[] = [
      { id: "1", primaryModel: null, fallbackModels: [] },
      { id: "2", primaryModel: null, fallbackModels: [] },
      { id: "3", primaryModel: null, fallbackModels: [] },
      { id: "4", primaryModel: null, fallbackModels: [] },
      { id: "5", primaryModel: null, fallbackModels: [] },
    ];
    render(
      <FallbackSelectionForm
        groups={groups}
        onGroupsChange={mockOnGroupsChange}
        availableModels={AVAILABLE_MODELS}
        maxGroups={5}
      />,
    );
    expect(screen.queryByRole("button", { name: /添加降级组/ })).not.toBeInTheDocument();
  });

  it("should show add tab button when below maxGroups with custom maxGroups", () => {
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: null, fallbackModels: [] }];
    render(
      <FallbackSelectionForm
        groups={groups}
        onGroupsChange={mockOnGroupsChange}
        availableModels={AVAILABLE_MODELS}
        maxGroups={3}
      />,
    );
    expect(screen.getByRole("button", { name: /添加降级组/ })).toBeInTheDocument();
  });

  it("should call onGroupsChange when a group is removed", async () => {
    const user = userEvent.setup();
    const groups: FallbackGroup[] = [
      { id: "1", primaryModel: "gpt-4", fallbackModels: [] },
      { id: "2", primaryModel: "gpt-3.5-turbo", fallbackModels: [] },
    ];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );

    const removeButtons = screen.getAllByRole("button", { name: /^移除 / });
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[0]);

    expect(mockOnGroupsChange).toHaveBeenCalledTimes(1);
    const [newGroups] = mockOnGroupsChange.mock.calls[0];
    expect(newGroups).toHaveLength(1);
    expect(newGroups[0].id).toBe("2");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("should render FallbackGroupConfig for each group", () => {
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: null, fallbackModels: [] }];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByRole("combobox", { name: /主模型/ })).toHaveValue("");
    expect(screen.getByText("主模型")).toBeInTheDocument();
  });

  it("should display group with primary and fallback models in FallbackGroupConfig", () => {
    const groups: FallbackGroup[] = [{ id: "1", primaryModel: "gpt-4", fallbackModels: ["gpt-3.5-turbo"] }];
    render(
      <FallbackSelectionForm groups={groups} onGroupsChange={mockOnGroupsChange} availableModels={AVAILABLE_MODELS} />,
    );
    expect(screen.getByRole("tab", { name: "gpt-4" })).toBeInTheDocument();
    expect(screen.getAllByText("gpt-4").length).toBeGreaterThan(0);
    const chain = screen.getByRole("list", { name: "降级链" });
    expect(within(chain).getByText("gpt-3.5-turbo")).toBeInTheDocument();
  });

  it("should not add group when add button clicked at maxGroups", () => {
    const groups: FallbackGroup[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      primaryModel: null,
      fallbackModels: [] as string[],
    }));
    render(
      <FallbackSelectionForm
        groups={groups}
        onGroupsChange={mockOnGroupsChange}
        availableModels={AVAILABLE_MODELS}
        maxGroups={5}
      />,
    );

    expect(screen.queryByRole("button", { name: /添加降级组/ })).not.toBeInTheDocument();
    expect(mockOnGroupsChange).not.toHaveBeenCalled();
  });
});
