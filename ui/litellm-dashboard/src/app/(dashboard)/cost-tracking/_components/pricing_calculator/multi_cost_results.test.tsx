import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../../../tests/test-utils";
import MultiCostResults from "./multi_cost_results";
import type { MultiModelResult } from "./types";
import type { CostEstimateResponse } from "../types";

vi.mock("./multi_export_utils", () => ({
  exportMultiToPDF: vi.fn(),
  exportMultiToCSV: vi.fn(),
}));

vi.mock("@/utils/dataUtils", () => ({
  formatNumberWithCommas: vi.fn((v: number, d: number = 0) => (Number.isFinite(v) ? v.toFixed(d) : "-")),
}));

function makeCostResponse(overrides: Partial<CostEstimateResponse> = {}): CostEstimateResponse {
  return {
    model: "gpt-4",
    input_tokens: 1000,
    output_tokens: 500,
    num_requests_per_day: 100,
    num_requests_per_month: null,
    cost_per_request: 0.05,
    input_cost_per_request: 0.03,
    output_cost_per_request: 0.02,
    margin_cost_per_request: 0,
    daily_cost: 5.0,
    daily_input_cost: 3.0,
    daily_output_cost: 2.0,
    daily_margin_cost: 0,
    monthly_cost: null,
    monthly_input_cost: null,
    monthly_output_cost: null,
    monthly_margin_cost: null,
    input_cost_per_token: null,
    output_cost_per_token: null,
    provider: "openai",
    ...overrides,
  };
}

function makeMultiResult(overrides: Partial<MultiModelResult> = {}): MultiModelResult {
  return {
    entries: [
      {
        entry: { id: "e1", model: "gpt-4", input_tokens: 1000, output_tokens: 500 },
        result: makeCostResponse(),
        loading: false,
        error: null,
      },
    ],
    totals: {
      cost_per_request: 0.05,
      daily_cost: 5.0,
      monthly_cost: null,
      margin_per_request: 0,
      daily_margin: null,
      monthly_margin: null,
    },
    ...overrides,
  };
}

function emptyMultiResult(): MultiModelResult {
  return {
    entries: [
      {
        entry: { id: "e1", model: "", input_tokens: 1000, output_tokens: 500 },
        result: null,
        loading: false,
        error: null,
      },
    ],
    totals: {
      cost_per_request: 0,
      daily_cost: null,
      monthly_cost: null,
      margin_per_request: 0,
      daily_margin: null,
      monthly_margin: null,
    },
  };
}

const expandToggle = (): HTMLElement => screen.getByRole("button", { name: /的成本明细$/ });

const shownBreakdown = (): HTMLElement | null => {
  // The expanded breakdown is the only place rendering the localized "{period} input" label
  const label = screen.queryByText("每日输入");
  if (label === null) return null;
  return label.closest("[style*='display: none']") === null ? label : null;
};

describe("MultiCostResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when no model has been selected", () => {
    it("should show a prompt to select models", () => {
      renderWithProviders(<MultiCostResults multiResult={emptyMultiResult()} timePeriod="month" />);
      expect(screen.getByText("在上方选择模型以查看成本估算")).toBeInTheDocument();
    });
  });

  describe("when results are loading and no data has arrived yet", () => {
    it("should show a calculating costs spinner", () => {
      const multiResult: MultiModelResult = {
        entries: [
          {
            entry: { id: "e1", model: "gpt-4", input_tokens: 1000, output_tokens: 500 },
            result: null,
            loading: true,
            error: null,
          },
        ],
        totals: {
          cost_per_request: 0,
          daily_cost: null,
          monthly_cost: null,
          margin_per_request: 0,
          daily_margin: null,
          monthly_margin: null,
        },
      };

      renderWithProviders(<MultiCostResults multiResult={multiResult} timePeriod="month" />);
      expect(screen.getByText(/正在计算成本/)).toBeInTheDocument();
    });
  });

  describe("when there are errors but no valid results", () => {
    it("should display the error message with the model name", () => {
      const multiResult: MultiModelResult = {
        entries: [
          {
            entry: { id: "e1", model: "bad-model", input_tokens: 0, output_tokens: 0 },
            result: null,
            loading: false,
            error: "Pricing not found",
          },
        ],
        totals: {
          cost_per_request: 0,
          daily_cost: null,
          monthly_cost: null,
          margin_per_request: 0,
          daily_margin: null,
          monthly_margin: null,
        },
      };

      renderWithProviders(<MultiCostResults multiResult={multiResult} timePeriod="month" />);
      expect(screen.getByText(/bad-model/i)).toBeInTheDocument();
      expect(screen.getByText(/Pricing not found/i)).toBeInTheDocument();
    });
  });

  describe("when valid results are available", () => {
    it("should show the Cost Estimates heading", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByText("成本估算")).toBeInTheDocument();
    });

    it("should display the Total Per Request statistic", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByText("每请求总计")).toBeInTheDocument();
    });

    it("should display Total Daily statistic when timePeriod is day", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByText("每日总计")).toBeInTheDocument();
    });

    it("should display Total Monthly statistic when timePeriod is month", () => {
      renderWithProviders(
        <MultiCostResults
          multiResult={makeMultiResult({
            totals: {
              cost_per_request: 0.05,
              daily_cost: null,
              monthly_cost: 150.0,
              margin_per_request: 0,
              daily_margin: null,
              monthly_margin: null,
            },
          })}
          timePeriod="month"
        />,
      );
      expect(screen.getByText("每月总计")).toBeInTheDocument();
    });

    it("should show the model name in the summary table", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByText("gpt-4")).toBeInTheDocument();
    });

    it("should show the provider tag next to the model name", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByText("openai")).toBeInTheDocument();
    });

    it("should show the Export button when results are available", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    });

    it("should render a column header for each summary column", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);

      expect(screen.getByRole("columnheader", { name: "模型" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "每请求" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "加价费用" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "每日" })).toBeInTheDocument();
    });

    it("should not show the model breakdown before the row is expanded", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(shownBreakdown()).toBeNull();
    });

    it("should expand the model breakdown row when the expand button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);

      await user.click(expandToggle());

      expect(shownBreakdown()).toBeVisible();
      expect(screen.getByText("每日总计（100 次请求）")).toBeInTheDocument();
    });

    it("should collapse the model breakdown again on a second click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);

      await user.click(expandToggle());
      expect(shownBreakdown()).toBeVisible();

      await user.click(expandToggle());
      expect(shownBreakdown()).toBeNull();
    });

    it("should name the breakdown toggle and report its expanded state", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);

      const toggle = screen.getByRole("button", { name: "展开查看 gpt-4 的成本明细" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);

      const collapseToggle = screen.getByRole("button", { name: "收起 gpt-4 的成本明细" });
      expect(collapseToggle).toHaveAttribute("aria-expanded", "true");
    });

    it("should not offer an expand toggle for a row that failed", () => {
      renderWithProviders(
        <MultiCostResults
          multiResult={makeMultiResult({
            entries: [
              {
                entry: { id: "e1", model: "gpt-4", input_tokens: 1000, output_tokens: 500 },
                result: makeCostResponse(),
                loading: false,
                error: null,
              },
              {
                entry: { id: "e2", model: "bad-model", input_tokens: 0, output_tokens: 0 },
                result: null,
                loading: false,
                error: "Pricing not found",
              },
            ],
          })}
          timePeriod="day"
        />,
      );

      expect(screen.getAllByRole("button", { name: /的成本明细$/ })).toHaveLength(1);
    });
  });

  describe("margin section", () => {
    it("should show margin fee details when margin per request is greater than zero", () => {
      const multiResult = makeMultiResult({
        entries: [
          {
            entry: { id: "e1", model: "gpt-4", input_tokens: 1000, output_tokens: 500 },
            result: makeCostResponse({ margin_cost_per_request: 0.01, daily_margin_cost: 1.0 }),
            loading: false,
            error: null,
          },
        ],
        totals: {
          cost_per_request: 0.06,
          daily_cost: 6.0,
          monthly_cost: null,
          margin_per_request: 0.01,
          daily_margin: 1.0,
          monthly_margin: null,
        },
      });

      renderWithProviders(<MultiCostResults multiResult={multiResult} timePeriod="day" />);
      expect(screen.getByText("每请求加价费用")).toBeInTheDocument();
    });

    it("should not show margin fee details when margin per request is zero", () => {
      renderWithProviders(<MultiCostResults multiResult={makeMultiResult()} timePeriod="day" />);
      expect(screen.queryByText("每请求加价费用")).not.toBeInTheDocument();
    });
  });

  describe("when a model has zero cost", () => {
    it("should show a warning about missing pricing data", () => {
      const multiResult = makeMultiResult({
        entries: [
          {
            entry: { id: "e1", model: "custom-model", input_tokens: 1000, output_tokens: 500 },
            result: makeCostResponse({ model: "custom-model", cost_per_request: 0 }),
            loading: false,
            error: null,
          },
        ],
      });

      renderWithProviders(<MultiCostResults multiResult={multiResult} timePeriod="day" />);
      expect(screen.getByText(/未找到该模型的定价数据/)).toBeInTheDocument();
    });
  });
});
