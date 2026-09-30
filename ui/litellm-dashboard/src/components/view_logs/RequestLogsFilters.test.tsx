import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseSelectOption, renderWithProviders, testQueryClient } from "../../../tests/test-utils";
import { ERROR_CODE_OPTIONS } from "./constants";
import { LOG_FILTER_IDS } from "./log_filter_logic";
import { RequestLogsFilters } from "./RequestLogsFilters";

vi.mock("@/app/(dashboard)/hooks/keys/useKeyAliases", () => ({
  useInfiniteKeyAliases: vi.fn(),
}));

vi.mock("@/app/(dashboard)/hooks/models/useModels", () => ({
  useInfiniteModelInfo: vi.fn(),
}));

vi.mock("@/app/(dashboard)/hooks/spendLogs/useSpendLogUsers", () => ({
  useInfiniteSpendLogUsers: vi.fn(),
}));

vi.mock("@/app/(dashboard)/hooks/spendLogs/useSpendLogEndUsers", () => ({
  useInfiniteSpendLogEndUsers: vi.fn(),
}));

import { useInfiniteSpendLogEndUsers } from "@/app/(dashboard)/hooks/spendLogs/useSpendLogEndUsers";
import { useInfiniteSpendLogUsers } from "@/app/(dashboard)/hooks/spendLogs/useSpendLogUsers";
import { useInfiniteKeyAliases } from "@/app/(dashboard)/hooks/keys/useKeyAliases";
import { useInfiniteModelInfo } from "@/app/(dashboard)/hooks/models/useModels";

const emptyInfiniteQuery = {
  data: { pages: [], pageParams: [] },
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
};

const LOGS_WINDOW = { start_date: "2026-07-23 00:00:00", end_date: "2026-07-24 00:00:00" };

function renderFilters(filters: Record<string, string> = {}) {
  const set = vi.fn();
  renderWithProviders(
    <RequestLogsFilters get={(id: string) => filters[id]} set={set} teams={[]} logsWindow={LOGS_WINDOW} />,
  );
  return { set };
}

function StatefulFilters() {
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  return (
    <RequestLogsFilters
      get={(id: string) => filters[id]}
      set={(id: string, value: unknown) =>
        setFilters((previous) => ({ ...previous, [id]: typeof value === "string" ? value : undefined }))
      }
      teams={[]}
      logsWindow={LOGS_WINDOW}
    />
  );
}

describe("RequestLogsFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient.clear();
    vi.mocked(useInfiniteKeyAliases).mockReturnValue(
      emptyInfiniteQuery as unknown as ReturnType<typeof useInfiniteKeyAliases>,
    );
    vi.mocked(useInfiniteModelInfo).mockReturnValue(
      emptyInfiniteQuery as unknown as ReturnType<typeof useInfiniteModelInfo>,
    );
    vi.mocked(useInfiniteSpendLogUsers).mockReturnValue(
      emptyInfiniteQuery as unknown as ReturnType<typeof useInfiniteSpendLogUsers>,
    );
    vi.mocked(useInfiniteSpendLogEndUsers).mockReturnValue(
      emptyInfiniteQuery as unknown as ReturnType<typeof useInfiniteSpendLogEndUsers>,
    );
  });

  it("renders every backend-supported filter field", async () => {
    renderFilters();

    for (const label of [
      "团队 ID",
      "状态",
      "缓存",
      "密钥别名",
      "内部用户 ID",
      "终端用户 ID",
      "错误码",
      "错误信息",
      "密钥哈希",
      "会话 ID",
      "模型",
      "公共模型名",
    ]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it("places User ID between Key Alias and End User", async () => {
    renderFilters();

    const labels = ["密钥别名", "内部用户 ID", "终端用户 ID"].map((label) => screen.getByText(label));
    expect(labels[0].compareDocumentPosition(labels[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(labels[1].compareDocumentPosition(labels[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("selects an internal user value from the caller's visible spend logs", async () => {
    vi.mocked(useInfiniteSpendLogUsers).mockReturnValue({
      ...emptyInfiniteQuery,
      data: {
        pages: [
          {
            data: ["alice@example.com"],
            meta: { page: 1, page_size: 50, has_more: false },
            links: { self: "", next: null },
          },
        ],
        pageParams: [1],
      },
    } as unknown as ReturnType<typeof useInfiniteSpendLogUsers>);
    const user = userEvent.setup();
    const { set } = renderFilters();

    await chooseSelectOption(user, await screen.findByPlaceholderText("搜索内部用户…"), "alice@example.com");

    expect(set).toHaveBeenCalledWith(LOG_FILTER_IDS.USER_ID, "alice@example.com");
  });

  it("pushes the User ID picker query to the paginated user lookup", async () => {
    const user = userEvent.setup();
    renderFilters();

    const input = await screen.findByPlaceholderText("搜索内部用户…");
    await user.click(input);
    fireEvent.change(input, { target: { value: "alice@example.com" } });

    await waitFor(() => expect(useInfiniteSpendLogUsers).toHaveBeenCalledWith(LOGS_WINDOW, 50, "alice@example.com"));
  });

  it("loads the next page when the User ID list is scrolled near the end", async () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useInfiniteSpendLogUsers).mockReturnValue({
      ...emptyInfiniteQuery,
      fetchNextPage,
      hasNextPage: true,
      data: {
        pages: [
          {
            data: ["alice@example.com"],
            meta: { page: 1, page_size: 50, has_more: true },
            links: { self: "", next: "?page=2" },
          },
        ],
        pageParams: [1],
      },
    } as unknown as ReturnType<typeof useInfiniteSpendLogUsers>);
    const user = userEvent.setup();
    renderFilters();

    await user.click(await screen.findByPlaceholderText("搜索内部用户…"));
    const list = await screen.findByTestId("paginated-search-select-list");
    Object.defineProperty(list, "scrollTop", { value: 90, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 10, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 100, configurable: true });
    list.dispatchEvent(new Event("scroll", { bubbles: true }));

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });

  it("scopes the Key Alias lookup to the selected team", async () => {
    renderFilters({ [LOG_FILTER_IDS.TEAM_ID]: "team-42" });

    await waitFor(() => expect(useInfiniteKeyAliases).toHaveBeenCalled());
    expect(useInfiniteKeyAliases).toHaveBeenCalledWith(50, undefined, "team-42");
  });

  it("leaves the Key Alias lookup unscoped when no team is selected", async () => {
    renderFilters();

    await waitFor(() => expect(useInfiniteKeyAliases).toHaveBeenCalled());
    expect(useInfiniteKeyAliases).toHaveBeenCalledWith(50, undefined, undefined);
  });

  it("does not leak the team scope into the Model lookup", async () => {
    renderFilters({ [LOG_FILTER_IDS.TEAM_ID]: "team-42" });

    await waitFor(() => expect(useInfiniteModelInfo).toHaveBeenCalled());
    expect(useInfiniteModelInfo).toHaveBeenCalledWith(50, undefined);
  });

  it("asks the server for a bounded page of end users scoped to the visible time window", async () => {
    renderFilters();

    await waitFor(() => expect(useInfiniteSpendLogEndUsers).toHaveBeenCalled());
    expect(useInfiniteSpendLogEndUsers).toHaveBeenCalledWith(LOGS_WINDOW, 50, undefined);
  });

  it("pushes the End User query to the server rather than filtering a preloaded list", async () => {
    const user = userEvent.setup();
    renderFilters();

    const input = await screen.findByPlaceholderText("搜索终端用户…");
    await user.click(input);
    fireEvent.change(input, { target: { value: "acme" } });

    await waitFor(() => expect(useInfiniteSpendLogEndUsers).toHaveBeenCalledWith(LOGS_WINDOW, 50, "acme"));
  });

  it("renders only the end users the current page returned", async () => {
    vi.mocked(useInfiniteSpendLogEndUsers).mockReturnValue({
      ...emptyInfiniteQuery,
      data: {
        pages: [
          {
            data: ["cust-a", "cust-b"],
            meta: { page: 1, page_size: 50, has_more: true },
            links: { self: "", next: "?page=2" },
          },
        ],
        pageParams: [1],
      },
    } as unknown as ReturnType<typeof useInfiniteSpendLogEndUsers>);
    const user = userEvent.setup();
    renderFilters();

    await user.click(await screen.findByPlaceholderText("搜索终端用户…"));

    expect(await screen.findByText("cust-a")).toBeInTheDocument();
    expect(screen.getByText("cust-b")).toBeInTheDocument();
  });

  it("loads the next page when the End User list is scrolled near the end", async () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useInfiniteSpendLogEndUsers).mockReturnValue({
      ...emptyInfiniteQuery,
      fetchNextPage,
      hasNextPage: true,
      data: {
        pages: [
          { data: ["cust-a"], meta: { page: 1, page_size: 50, has_more: true }, links: { self: "", next: "?page=2" } },
        ],
        pageParams: [1],
      },
    } as unknown as ReturnType<typeof useInfiniteSpendLogEndUsers>);
    const user = userEvent.setup();
    renderFilters();

    await user.click(await screen.findByPlaceholderText("搜索终端用户…"));
    const list = await screen.findByTestId("paginated-search-select-list");
    Object.defineProperty(list, "scrollTop", { value: 90, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 10, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 100, configurable: true });
    list.dispatchEvent(new Event("scroll", { bubbles: true }));

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });

  it("scopes the End User lookup to the window the logs table is showing", async () => {
    const otherWindow = { start_date: "2026-01-01 00:00:00", end_date: "2026-01-02 00:00:00" };
    renderWithProviders(<RequestLogsFilters get={() => undefined} set={vi.fn()} teams={[]} logsWindow={otherWindow} />);

    await waitFor(() => expect(useInfiniteSpendLogEndUsers).toHaveBeenCalledWith(otherWindow, 50, undefined));
  });

  it.each([
    ["", "全部状态"],
    ["success", "成功"],
    ["failure", "失败"],
  ])("shows the human label on the Status trigger for %s", async (status, label) => {
    renderFilters(status === "" ? {} : { [LOG_FILTER_IDS.STATUS]: status });

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it.each([
    ["", "全部缓存"],
    ["hit", "命中"],
    ["miss", "未命中"],
  ])("shows the human label on the Cache trigger for %s", async (cacheState, label) => {
    renderFilters(cacheState === "" ? {} : { [LOG_FILTER_IDS.CACHE_STATUS]: cacheState });

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it.each([
    ["命中", "hit"],
    ["未命中", "miss"],
  ])("selecting %s sets the cache filter to %s", async (label, expected) => {
    const user = userEvent.setup();
    const { set } = renderFilters();

    await user.click(await screen.findByText("全部缓存"));
    await user.click(await screen.findByRole("option", { name: label }));

    expect(set).toHaveBeenCalledWith(LOG_FILTER_IDS.CACHE_STATUS, expected);
  });

  it("stores the raw status code when a labeled error code is picked", async () => {
    const user = userEvent.setup();
    const { set } = renderFilters();

    await user.click(await screen.findByPlaceholderText("搜索错误码…"));
    await user.click(await screen.findByRole("option", { name: "429 - 请求过于频繁" }));

    expect(set).toHaveBeenCalledWith(LOG_FILTER_IDS.ERROR_CODE, "429");
  });

  it("offers every error code again after one was picked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatefulFilters />);

    const input = await screen.findByPlaceholderText("搜索错误码…");
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "429 - 请求过于频繁" }));
    await user.click(input);

    const list = await screen.findByTestId("error-code-filter-list");
    expect(within(list).getAllByRole("option")).toHaveLength(ERROR_CODE_OPTIONS.length);
    expect(within(list).queryByText(/^使用自定义错误码：/)).not.toBeInTheDocument();
  });

  it("filters by an error code the list does not offer", async () => {
    const user = userEvent.setup();
    const { set } = renderFilters();

    const input = await screen.findByPlaceholderText("搜索错误码…");
    await user.click(input);
    await user.type(input, "418");
    await user.click(await screen.findByRole("option", { name: "使用自定义错误码：418" }));

    expect(set).toHaveBeenCalledWith(LOG_FILTER_IDS.ERROR_CODE, "418");
  });

  it("selecting All Requests clears the cache filter", async () => {
    const user = userEvent.setup();
    const { set } = renderFilters({ [LOG_FILTER_IDS.CACHE_STATUS]: "hit" });

    await user.click(await screen.findByText("命中"));
    await user.click(await screen.findByRole("option", { name: "全部缓存" }));

    expect(set).toHaveBeenCalledWith(LOG_FILTER_IDS.CACHE_STATUS, undefined);
  });
});
