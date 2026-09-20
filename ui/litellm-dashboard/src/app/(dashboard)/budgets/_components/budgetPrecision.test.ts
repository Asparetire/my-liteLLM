import { describe, expect, it } from "vitest";

import { applyBudgetPrecision } from "./budgetPrecision";

describe("applyBudgetPrecision", () => {
  it("rounds each budget field to an integer, since token and rate limits are whole numbers", () => {
    const typed = { budget_id: "b", tpm_limit: 500.567, rpm_limit: 7.005, max_budget: 42.567 };
    const rounded = { budget_id: "b", tpm_limit: 501, rpm_limit: 7, max_budget: 43 };

    expect(applyBudgetPrecision(typed)).toEqual(rounded);
  });

  it("leaves non-budget fields untouched even when numeric", () => {
    expect(applyBudgetPrecision({ soft_budget: 1.239, budget_duration: "30d" })).toEqual({
      soft_budget: 1.239,
      budget_duration: "30d",
    });
  });

  it("preserves key presence exactly, so an omitted field is not reintroduced as undefined", () => {
    expect(Object.keys(applyBudgetPrecision({ budget_id: "b", tpm_limit: 1 }))).toEqual(["budget_id", "tpm_limit"]);
  });

  it("passes null and undefined through without coercing them to a number", () => {
    expect(applyBudgetPrecision({ tpm_limit: null, rpm_limit: undefined, max_budget: 1.005 })).toEqual({
      tpm_limit: null,
      rpm_limit: undefined,
      max_budget: 1,
    });
  });

  it("rounds a fractional negative with Math.round semantics", () => {
    expect(applyBudgetPrecision({ max_budget: -1.005 })).toEqual({ max_budget: -1 });
  });

  it("returns non-finite values unchanged rather than emitting NaN", () => {
    expect(applyBudgetPrecision({ max_budget: Number.POSITIVE_INFINITY })).toEqual({
      max_budget: Number.POSITIVE_INFINITY,
    });
  });

  it("does not disturb a value that is already an integer", () => {
    expect(applyBudgetPrecision({ max_budget: 42, tpm_limit: 500 })).toEqual({ max_budget: 42, tpm_limit: 500 });
  });
});
