import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { useAuthorizedMock } = vi.hoisted(() => ({ useAuthorizedMock: vi.fn() }));

vi.mock("@/app/(dashboard)/hooks/useAuthorized", () => ({
  default: useAuthorizedMock,
}));

vi.mock("@/components/networking", () => ({
  organizationListCall: vi.fn().mockResolvedValue([]),
  userDailyActivityCall: vi
    .fn()
    .mockResolvedValue({ results: [], metadata: { total_pages: 1, has_more: false, page: 1 } }),
  userDailyActivityAggregatedCall: vi
    .fn()
    .mockResolvedValue({ results: [], metadata: { total_pages: 1, has_more: false, page: 1 } }),
}));

vi.mock("./UsageTab", () => ({ __esModule: true, default: () => <div data-testid="usage-tab" /> }));
vi.mock("./PromptCompressionTab", () => ({ __esModule: true, default: () => <div data-testid="compression-tab" /> }));
vi.mock("./PromptCachingTab", () => ({ __esModule: true, default: () => <div data-testid="caching-tab" /> }));
vi.mock("./AutoRouterBenchmarksTab", () => ({
  __esModule: true,
  default: () => <div data-testid="autorouter-benchmarks-tab" />,
}));

import CostOptimizationView from "./CostOptimizationView";

const renderView = (userRole = "Admin") => {
  useAuthorizedMock.mockReturnValue({ accessToken: "test-token", userId: "u1", userRole });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CostOptimizationView accessToken="test-token" userId="u1" userRole={userRole} />
    </QueryClientProvider>,
  );
};

describe("CostOptimizationView", () => {
  beforeEach(() => {
    useAuthorizedMock.mockReturnValue({ accessToken: "test-token", userId: "u1", userRole: "Admin" });
  });

  it("renders the standard page header with the sidebar's Cost Optimization icon", () => {
    const { container } = renderView();

    expect(screen.getByRole("heading", { level: 1, name: "成本优化" })).toBeInTheDocument();
    expect(screen.getByText(/跟踪并配置为你省钱的两项机制/)).toBeInTheDocument();
    expect(container.querySelector(".lucide-piggy-bank")).not.toBeNull();
  });

  it("renders the four cost-optimization tabs", () => {
    renderView();

    expect(screen.getByText("总览")).toBeInTheDocument();
    expect(screen.getByText("Prompt 压缩")).toBeInTheDocument();
    expect(screen.getByText("Prompt 缓存")).toBeInTheDocument();
    expect(screen.getByText("自动路由")).toBeInTheDocument();
  });

  it("defaults to the Overall tab and switches the active tab on click", () => {
    renderView();

    expect(screen.getByRole("tab", { name: "总览" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Prompt 压缩" })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("tab", { name: "Prompt 压缩" }));

    expect(screen.getByRole("tab", { name: "总览" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Prompt 压缩" })).toHaveAttribute("aria-selected", "true");
  });

  // Unlike the other three pages in this cleanup, Cost Optimization keeps its
  // nav entry for internal users: the Overall tab runs on /user/daily/activity,
  // which every role may call. Only the tabs reading proxy-wide config and
  // telemetry (/config/list, /auto_router/benchmarks, guardrail management)
  // are proxy-admin-only, so those are what disappear.
  describe("proxy-admin-only tabs", () => {
    it.each(["Internal User", "Internal Viewer", "Org Admin"])("shows %s the Overall tab only", (userRole) => {
      renderView(userRole);

      expect(screen.getByRole("tab", { name: "总览" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Prompt 压缩" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Prompt 缓存" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "自动路由" })).not.toBeInTheDocument();
    });

    it("never mounts the panels behind the admin-only endpoints for an internal user", () => {
      renderView("Internal User");

      expect(screen.getByTestId("usage-tab")).toBeInTheDocument();
      expect(screen.queryByTestId("compression-tab")).not.toBeInTheDocument();
      expect(screen.queryByTestId("caching-tab")).not.toBeInTheDocument();
      expect(screen.queryByTestId("autorouter-benchmarks-tab")).not.toBeInTheDocument();
    });
  });
});
