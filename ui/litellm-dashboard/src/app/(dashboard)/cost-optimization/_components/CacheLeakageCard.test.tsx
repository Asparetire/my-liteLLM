import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DailyData, KeyMetricWithMetadata, SpendMetrics } from "@/components/UsagePage/types";
import type { DailyActivityRange } from "./useDailyActivityRange";

vi.mock("@/components/shared/advanced_date_picker", () => ({
  __esModule: true,
  default: () => <div data-testid="date-picker" />,
}));

import CacheLeakageCard from "./CacheLeakageCard";

const baseMetrics = (overrides: Partial<SpendMetrics>): SpendMetrics => ({
  spend: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  api_requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  ...overrides,
});

const key = (alias: string, metrics: Partial<SpendMetrics>): KeyMetricWithMetadata => ({
  metrics: baseMetrics(metrics),
  metadata: { key_alias: alias, team_id: null },
});

const dayWithKeys = (date: string, apiKeys: Record<string, KeyMetricWithMetadata>): DailyData => ({
  date,
  metrics: baseMetrics({}),
  breakdown: {
    models: {},
    model_groups: {},
    mcp_servers: {},
    providers: {},
    api_keys: apiKeys,
    entities: {},
  },
});

const dayWithModels = (date: string, models: Record<string, Partial<SpendMetrics>>): DailyData => ({
  date,
  metrics: baseMetrics({}),
  breakdown: {
    models: Object.fromEntries(
      Object.entries(models).map(([name, m]) => [
        name,
        { metrics: baseMetrics(m), metadata: {}, api_key_breakdown: {} },
      ]),
    ),
    model_groups: {},
    mcp_servers: {},
    providers: {},
    api_keys: {},
    entities: {},
  },
});

const renderWith = (results: DailyData[], overrides: Partial<DailyActivityRange> = {}) =>
  render(
    <CacheLeakageCard
      activity={{
        dateValue: {},
        onDateChange: vi.fn(),
        results,
        loading: false,
        isFetchingMore: false,
        progress: { currentPage: 1, totalPages: 1 },
        cancelled: false,
        cancel: vi.fn(),
        ...overrides,
      }}
    />,
  );

describe("CacheLeakageCard", () => {
  it("ranks leaking keys by uncached prompt tokens and shows cache hit ratio", () => {
    renderWith([
      dayWithKeys("2026-07-12", {
        "hash-caching": key("caching-key", { prompt_tokens: 1000, cache_read_input_tokens: 900 }),
        "hash-leaky": key("leaky-key", { prompt_tokens: 10000, cache_read_input_tokens: 0 }),
      }),
    ]);

    expect(screen.getByText("leaky-key")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("90.0%")).toBeInTheDocument();
    [
      "该时间段内你发送、但既未从缓存读取也未写入缓存的输入 token",
      "你的输入 token 中由缓存服务的占比",
      "假如这部分未缓存输入用上 prompt 缓存大约能省多少。估算方式为未缓存输入 token 数乘以缓存流量当前每个缓存 token 的净省额（已实现缓存节省，扣除写入溢价后，除以缓存读与写 token 数）。缓存整体没有节省时留空。",
    ].forEach((info) => expect(screen.getByLabelText(info)).toBeInTheDocument());
  });

  it("sorts by the clicked column, worst cache hit rate first", () => {
    renderWith([
      dayWithKeys("2026-07-12", {
        "hash-a": key("alpha", {
          prompt_tokens: 10000,
          cache_read_input_tokens: 9000,
          prompt_caching_savings_spend: 9.0,
        }),
        "hash-b": key("bravo", {
          prompt_tokens: 500,
          cache_read_input_tokens: 50,
          prompt_caching_savings_spend: 0.05,
        }),
      }),
    ]);
    const firstDataRow = () => screen.getAllByRole("row")[1];

    expect(firstDataRow()).toHaveTextContent("alpha");

    fireEvent.click(screen.getByText("缓存命中率"));
    expect(firstDataRow()).toHaveTextContent("bravo");

    fireEvent.click(screen.getByText("缓存命中率"));
    expect(firstDataRow()).toHaveTextContent("alpha");
  });

  it("switches to the model view and lists only Anthropic models", () => {
    renderWith([
      dayWithModels("2026-07-12", {
        "claude-sonnet-5": { prompt_tokens: 5000, cache_read_input_tokens: 0 },
        "gpt-4o": { prompt_tokens: 8000, cache_read_input_tokens: 0 },
      }),
    ]);

    fireEvent.click(screen.getByText("按模型"));

    expect(screen.getByText("按模型的缓存泄漏")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-5")).toBeInTheDocument();
    expect(screen.queryByText("gpt-4o")).not.toBeInTheDocument();
  });

  it("shows an empty state when no key used tokens in the range", () => {
    renderWith([dayWithKeys("2026-07-12", {})]);

    expect(screen.getByText("该时间段内没有密钥用量。")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tells the user the table is still filling in while fallback pages stream", () => {
    const day = dayWithKeys("2026-07-12", {
      "hash-leaky": key("leaky-key", { prompt_tokens: 10000, cache_read_input_tokens: 0 }),
    });
    renderWith([day], { isFetchingMore: true });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByText("数据仍在加载；随着其余数据到达，行与合计会更新。"),
    ).toBeInTheDocument();
  });

  it("keeps the streaming note off while a fresh range loads over the previous range's rows", () => {
    const day = dayWithKeys("2026-07-12", {
      "hash-leaky": key("leaky-key", { prompt_tokens: 10000, cache_read_input_tokens: 0 }),
    });
    renderWith([day], { loading: true });

    expect(
      screen.queryByText("数据仍在加载；随着其余数据到达，行与合计会更新。"),
    ).not.toBeInTheDocument();
  });

  it("drops the streaming note once the range has settled", () => {
    const day = dayWithKeys("2026-07-12", {
      "hash-leaky": key("leaky-key", { prompt_tokens: 10000, cache_read_input_tokens: 0 }),
    });
    renderWith([day]);

    expect(
      screen.queryByText("数据仍在加载；随着其余数据到达，行与合计会更新。"),
    ).not.toBeInTheDocument();
  });
});
