import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "../../../../../../tests/test-utils";
import { useZodForm } from "@/lib/forms/useZodForm";
import { ProjectBaseForm } from "./ProjectBaseForm";
import { emptyProjectFormValues, projectFormSchema } from "./projectFormSchema";

const mockUseTeams = vi.fn();
vi.mock("@/app/(dashboard)/hooks/teams/useTeams", () => ({
  useTeams: () => mockUseTeams(),
}));

vi.mock("@/components/organisms/create_key_button", () => ({
  fetchTeamModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/networking", () => ({
  getGuardrailsList: vi.fn().mockResolvedValue({ guardrails: [] }),
}));

vi.mock("@/components/key_team_helpers/fetch_available_models_team_key", () => ({
  getModelDisplayName: (model: string) => model,
}));

function FormWrapper() {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const form = useZodForm(projectFormSchema, { defaultValues: emptyProjectFormValues });
  return <ProjectBaseForm form={form} advancedOpen={advancedOpen} onAdvancedOpenChange={setAdvancedOpen} />;
}

describe("ProjectBaseForm", () => {
  beforeEach(() => {
    mockUseTeams.mockReturnValue({ data: [], isLoading: false });
  });

  it("should render", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByLabelText("项目名称")).toBeInTheDocument();
  });

  it("should show a 'Basic Information' section heading", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByText("基本信息")).toBeInTheDocument();
  });

  it("should show a Project Name input", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByPlaceholderText("例如：客服机器人")).toBeInTheDocument();
  });

  it("should show a Team select", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByText("团队")).toBeInTheDocument();
  });

  it("should show a Description textarea", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByPlaceholderText("描述该项目的用途")).toBeInTheDocument();
  });

  it("should show the models select as disabled when no team is selected", () => {
    renderWithProviders(<FormWrapper />);
    // The models select should be disabled — its placeholder indicates no team yet
    expect(screen.getByText("请先选择团队")).toBeInTheDocument();
  });

  it("should show available team options when the Team dropdown is opened", async () => {
    const user = userEvent.setup();
    mockUseTeams.mockReturnValue({
      data: [
        { team_id: "team-1", team_alias: "Engineering", models: [] },
        { team_id: "team-2", team_alias: "Sales", models: [] },
      ],
      isLoading: false,
    });
    renderWithProviders(<FormWrapper />);
    // The form label "团队" is associated with the combobox input inside the Select
    await user.click(screen.getByLabelText("团队"));
    await waitFor(() => {
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });
    expect(screen.getByText("Sales")).toBeInTheDocument();
  });

  it("should show the Max Budget field", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByPlaceholderText("0")).toBeInTheDocument();
  });

  it("should show the Advanced Settings collapse panel", () => {
    renderWithProviders(<FormWrapper />);
    expect(screen.getByText("高级设置")).toBeInTheDocument();
  });

  it("should show a Guardrails field in the Advanced Settings section", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormWrapper />);
    await user.click(screen.getByText("高级设置"));
    await waitFor(() => {
      expect(screen.getByText("护栏")).toBeInTheDocument();
    });
  });

  it("should show combined, input, and output TPM limit inputs for a model row", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormWrapper />);
    await user.click(screen.getByText("高级设置"));
    await user.click(screen.getByRole("button", { name: /添加模型限额/ }));

    expect(screen.getByPlaceholderText("TPM 限额")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入 TPM 限额")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输出 TPM 限额")).toBeInTheDocument();
    expect(screen.getByLabelText("TPM 限额")).toBeInTheDocument();
    expect(screen.getByLabelText("输入 TPM 限额")).toBeInTheDocument();
    expect(screen.getByLabelText("输出 TPM 限额")).toBeInTheDocument();
  });
});
