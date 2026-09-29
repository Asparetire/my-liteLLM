import { describe, expect, it } from "vitest";
import { buildCostBreakdownTiles, buildSummaryTiles, hasFlatCost, type SummaryLabels } from "./entityUsageSummary";

// 纯模块测试：标签由调用方注入，这里传英文串只验证映射逻辑；组件侧传 t() 构建的中文标签
const labels: SummaryLabels = {
  totalCost: "Total Cost",
  totalSpend: "Total Spend",
  totalRequests: "Total Requests",
  successfulRequests: "Successful Requests",
  failedRequests: "Failed Requests",
  totalTokens: "Total Tokens",
  requestCost: "Request Cost",
  flatCost: "Flat Cost",
  totalCostTooltip: "Request cost plus flat capacity cost. Click to see the breakdown",
  requestCostTooltip: "Request usage cost priced per token",
  flatCostTooltip: "Flat capacity cost, outside of budgets",
};

const metadata = {
  total_spend: 100,
  total_flat_cost: 40,
  total_api_requests: 12,
  total_successful_requests: 10,
  total_failed_requests: 2,
  total_tokens: 3456,
};

describe("hasFlatCost", () => {
  it("is false when there is no flat cost to report", () => {
    expect(hasFlatCost({ ...metadata, total_flat_cost: 0 })).toBe(false);
    const { total_flat_cost, ...noFlat } = metadata;
    expect(hasFlatCost(noFlat)).toBe(false);
  });

  it("is true once a flat cost has accrued", () => {
    expect(hasFlatCost(metadata)).toBe(true);
  });
});

describe("buildSummaryTiles", () => {
  it("keeps the row at five tiles either way so adding flat cost never narrows the cards", () => {
    expect(buildSummaryTiles(metadata, false, labels)).toHaveLength(5);
    expect(buildSummaryTiles(metadata, true, labels)).toHaveLength(5);
  });

  it("shows request-only spend under the original title when there is no flat cost", () => {
    const [first] = buildSummaryTiles(metadata, false, labels);
    expect(first.title).toBe("Total Spend");
    expect(first.value).toBe("100 tokens");
    expect(first.expandable).toBeUndefined();
  });

  it("rolls flat cost into a single expandable Total Cost tile", () => {
    const [first] = buildSummaryTiles(metadata, true, labels);
    expect(first.title).toBe("Total Cost");
    expect(first.value).toBe("140 tokens");
    expect(first.expandable).toBe(true);
    expect(first.tooltip).toBeTruthy();
  });

  it("never renders the breakdown titles in the top row", () => {
    const titles = buildSummaryTiles(metadata, true, labels).map((t) => t.title);
    expect(titles).not.toContain("Flat Cost");
    expect(titles).not.toContain("Request Cost");
  });

  it("treats a missing flat cost as zero", () => {
    const { total_flat_cost, ...noFlat } = metadata;
    expect(buildSummaryTiles(noFlat, true, labels)[0].value).toBe("100 tokens");
  });
});

describe("buildCostBreakdownTiles", () => {
  it("splits the total into request cost and flat cost", () => {
    const byTitle = Object.fromEntries(buildCostBreakdownTiles(metadata, labels).map((t) => [t.title, t.value]));
    expect(byTitle["Request Cost"]).toBe("100 tokens");
    expect(byTitle["Flat Cost"]).toBe("40 tokens");
  });

  it("adds up to the Total Cost tile so the expanded view reconciles", () => {
    const parse = (v: string) => Number(v.replace(/[^\d.]/g, ""));
    const parts = buildCostBreakdownTiles(metadata, labels).map((t) => parse(t.value));
    expect(parts[0] + parts[1]).toBe(parse(buildSummaryTiles(metadata, true, labels)[0].value));
  });

  it("explains each part, including that flat cost is outside budgets", () => {
    const byTitle = Object.fromEntries(buildCostBreakdownTiles(metadata, labels).map((t) => [t.title, t.tooltip]));
    expect(byTitle["Request Cost"]).toBeTruthy();
    expect(byTitle["Flat Cost"]).toContain("budget");
  });

  it("treats a missing flat cost as zero", () => {
    const { total_flat_cost, ...noFlat } = metadata;
    const byTitle = Object.fromEntries(buildCostBreakdownTiles(noFlat, labels).map((t) => [t.title, t.value]));
    expect(byTitle["Flat Cost"]).toBe("0 tokens");
  });
});
