import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/lib/http/schema";

import EditBudgetModal from "./edit_budget_modal";
import { chooseSelectOption } from "../../../../../tests/test-utils";

const { updateMock } = vi.hoisted(() => ({ updateMock: vi.fn() }));

vi.mock("@/app/(dashboard)/hooks/budgets/useBudgets", () => ({
  useUpdateBudget: () => ({ mutateAsync: updateMock }),
}));

type BudgetItem = components["schemas"]["BudgetListItem"];

const EXISTING_BUDGET: BudgetItem = {
  budget_id: "budget-alpha",
  max_budget: 100,
  budget_duration: "7d",
  tpm_limit: 1000,
  rpm_limit: 10,
  soft_budget: 25,
  budget_reset_at: "2026-02-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const renderModal = () =>
  render(<EditBudgetModal isModalVisible={true} setIsModalVisible={vi.fn()} existingBudget={EXISTING_BUDGET} />);

const save = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "保存" }));

const openOptionalSettings = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText("可选设置"));
  await screen.findByLabelText("最大预算（tokens）");
};

describe("EditBudgetModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(undefined);
  });

  it("submits only the mounted fields when Optional Settings stays collapsed", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText("每分钟最大 token 数"));
    fireEvent.change(screen.getByLabelText("每分钟最大 token 数"), { target: { value: "500.567" } });
    await save(user);

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toEqual({
      budget_id: "budget-alpha",
      tpm_limit: 501,
      rpm_limit: 10,
    });
  });

  it("submits every field once Optional Settings is expanded", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText("每分钟最大 token 数"));
    fireEvent.change(screen.getByLabelText("每分钟最大 token 数"), { target: { value: "500.567" } });
    await user.clear(screen.getByLabelText("每分钟最大请求数"));
    fireEvent.change(screen.getByLabelText("每分钟最大请求数"), { target: { value: "7" } });

    await openOptionalSettings(user);
    await user.clear(screen.getByLabelText("最大预算（tokens）"));
    fireEvent.change(screen.getByLabelText("最大预算（tokens）"), { target: { value: "42.567" } });

    await chooseSelectOption(user, screen.getByRole("combobox"), "每月");

    await save(user);

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const expected = {
      budget_id: "budget-alpha",
      tpm_limit: 501,
      rpm_limit: 7,
      max_budget: 43,
      budget_duration: "30d",
    };

    expect(updateMock.mock.calls[0][0]).toEqual(expected);
  });

  it("keeps a typed Optional Setting when the section is collapsed and reopened, as antd's store did", async () => {
    const user = userEvent.setup();
    renderModal();

    await openOptionalSettings(user);
    const maxBudget = screen.getByLabelText("最大预算（tokens）");
    await user.clear(maxBudget);
    fireEvent.change(maxBudget, { target: { value: "99.25" } });

    await user.click(screen.getByText("可选设置"));
    await user.click(screen.getByText("可选设置"));

    expect(await screen.findByLabelText("最大预算（tokens）")).toHaveValue(99.25);

    await save(user);

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toMatchObject({ max_budget: 99 });
  });
});
