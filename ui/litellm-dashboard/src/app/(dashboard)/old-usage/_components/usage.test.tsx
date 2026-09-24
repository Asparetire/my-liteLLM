import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../../tests/test-utils";
import UsagePage from "./usage";

const networking = vi.hoisted(() => ({
  adminSpendLogsCall: vi.fn(),
  adminTopKeysCall: vi.fn(),
  adminTopModelsCall: vi.fn(),
  adminTopEndUsersCall: vi.fn(),
  teamSpendLogsCall: vi.fn(),
  tagsSpendLogsCall: vi.fn(),
  allTagNamesCall: vi.fn(),
  adminspendByProvider: vi.fn(),
  adminGlobalActivity: vi.fn(),
  adminGlobalActivityPerModel: vi.fn(),
  getProxyUISettings: vi.fn(),
  modelAvailableCall: vi.fn(),
  keyInfoV1Call: vi.fn(),
}));

vi.mock("@/components/networking", () => networking);
vi.mock("../../../../components/networking", () => networking);

vi.mock("@/app/(dashboard)/hooks/useAuthorized", () => ({
  default: () => ({
    accessToken: "sk-test",
    token: "tok",
    userRole: "Admin",
    userId: "u1",
    premiumUser: true,
  }),
}));

const UNLIMITED_SETTINGS = { DISABLE_EXPENSIVE_DB_QUERIES: false, NUM_SPEND_LOGS_ROWS: 10 };

const renderUsage = (overrides: Partial<React.ComponentProps<typeof UsagePage>> = {}) =>
  renderWithProviders(
    <UsagePage
      accessToken="sk-test"
      token="tok"
      userRole="Admin"
      userID="u1"
      keys={null}
      premiumUser={true}
      {...overrides}
    />,
  );

// Width of this window is guarded by "proves the flush window is wide enough".
const flushPendingRequests = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  networking.getProxyUISettings.mockResolvedValue(UNLIMITED_SETTINGS);
  networking.adminSpendLogsCall.mockResolvedValue([{ date: "2026-07-01", spend: 12.5 }]);
  networking.adminTopKeysCall.mockResolvedValue([
    { api_key: "sk-abcdefghijk", key_alias: "prod-key", total_spend: 9.5 },
  ]);
  networking.adminTopModelsCall.mockResolvedValue([{ model: "gpt-5.1", total_spend: 7.25 }]);
  networking.adminTopEndUsersCall.mockResolvedValue([
    { end_user: "customer-alpha", total_spend: 3.5, total_count: 42 },
  ]);
  networking.teamSpendLogsCall.mockResolvedValue({
    daily_spend: [{ date: "2026-07-01", "team-a": 5 }],
    teams: ["team-a"],
    total_spend_per_team: [{ team_id: "team-a", total_spend: 5 }],
  });
  networking.tagsSpendLogsCall.mockResolvedValue({ spend_per_tag: [{ name: "prod", spend: 4 }] });
  networking.allTagNamesCall.mockResolvedValue({ tag_names: ["prod", "staging"] });
  networking.adminspendByProvider.mockResolvedValue([{ provider: "openai", spend: 6.75 }]);
  networking.adminGlobalActivity.mockResolvedValue({
    sum_api_requests: 120,
    sum_total_tokens: 4500,
    daily_data: [{ date: "2026-07-01", api_requests: 120, total_tokens: 4500 }],
  });
  networking.adminGlobalActivityPerModel.mockResolvedValue([]);
  networking.modelAvailableCall.mockResolvedValue({ data: [] });
  networking.keyInfoV1Call.mockResolvedValue({ info: {} });
});

describe("old usage page", () => {
  describe("when the proxy has disabled expensive DB queries", () => {
    beforeEach(() => {
      networking.getProxyUISettings.mockResolvedValue({
        DISABLE_EXPENSIVE_DB_QUERIES: true,
        NUM_SPEND_LOGS_ROWS: 2500000,
      });
    });

    it("shows the database query limit warning instead of the usage dashboard", async () => {
      renderUsage();

      expect(await screen.findByText("数据库查询已达上限")).toBeInTheDocument();
      expect(screen.getByText(/数据库中 SpendLogs 已有/)).toHaveTextContent("2500000");
      expect(screen.getByText(/SpendLogs 超过 100 万行/));
      expect(screen.queryByRole("tab", { name: "汇总" })).not.toBeInTheDocument();
    });

    it("links to the cost tracking guide in a new tab", async () => {
      renderUsage();

      const link = await screen.findByRole("link", { name: "查看用量指引" });
      expect(link).toHaveAttribute("href", "https://docs.litellm.ai/docs/proxy/cost_tracking");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("skips every expensive usage query", async () => {
      renderUsage();

      await screen.findByText("数据库查询已达上限");
      await waitFor(() => expect(networking.getProxyUISettings).toHaveBeenCalled());

      expect(networking.adminSpendLogsCall).not.toHaveBeenCalled();
      expect(networking.adminspendByProvider).not.toHaveBeenCalled();
      expect(networking.adminTopKeysCall).not.toHaveBeenCalled();
      expect(networking.adminTopModelsCall).not.toHaveBeenCalled();
      expect(networking.adminGlobalActivity).not.toHaveBeenCalled();
      expect(networking.adminGlobalActivityPerModel).not.toHaveBeenCalled();
      expect(networking.teamSpendLogsCall).not.toHaveBeenCalled();
      expect(networking.adminTopEndUsersCall).not.toHaveBeenCalled();
      expect(networking.tagsSpendLogsCall).not.toHaveBeenCalled();
    });
  });

  describe("as an admin", () => {
    it("renders the admin tabs", async () => {
      renderUsage();

      expect(await screen.findByRole("tab", { name: "汇总" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "团队用量" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "客户用量" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "标签用量" })).toBeInTheDocument();
    });

    it("renders the cost panel cards", async () => {
      renderUsage();

      expect(await screen.findByText("月度支出")).toBeInTheDocument();
      expect(screen.getByText("虚拟密钥排行")).toBeInTheDocument();
      expect(screen.getByText("模型排行")).toBeInTheDocument();
      expect(screen.getByText("按提供商统计支出")).toBeInTheDocument();
    });

    it("lists spend by provider in a table", async () => {
      renderUsage();

      const providerCell = await screen.findByText("openai");
      const row = providerCell.closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText("7 tokens")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "提供商" })).toBeInTheDocument();
    });

    it("shows the customer usage table when its tab is selected", async () => {
      const user = userEvent.setup();
      renderUsage();

      await user.click(await screen.findByRole("tab", { name: "客户用量" }));

      const customerCell = await screen.findByText("customer-alpha");
      const row = customerCell.closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText("4 tokens")).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText("42")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "调用次数" })).toBeInTheDocument();
    });

    it("shows the tag spend panel when its tab is selected", async () => {
      const user = userEvent.setup();
      renderUsage();

      await user.click(await screen.findByRole("tab", { name: "标签用量" }));

      expect(await screen.findByText("各标签支出")).toBeInTheDocument();
    });

    it("shows the team spend panel when its tab is selected", async () => {
      const user = userEvent.setup();
      renderUsage();

      await user.click(await screen.findByRole("tab", { name: "团队用量" }));

      expect(await screen.findByText("各团队总支出")).toBeInTheDocument();
      expect(screen.getByText("各团队每日支出")).toBeInTheDocument();
    });
  });

  // org_admin is an organization membership role; those users reach the UI as "Internal User".
  describe.each(["Internal User", "Internal Viewer", "internal_user", "internal_user_viewer", "Org Admin"])(
    "as %s",
    (userRole) => {
      it("shows the admin-only notice instead of the usage dashboard", async () => {
        renderUsage({ userRole });

        expect(await screen.findByText(/全代理用量仅管理员可用/)).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: "汇总" })).not.toBeInTheDocument();
      });

      it("fires no /global/spend or /global/activity request", async () => {
        renderUsage({ userRole });

        await screen.findByText(/全代理用量仅管理员可用/);
        await flushPendingRequests();

        expect(networking.getProxyUISettings).not.toHaveBeenCalled();
        expect(networking.adminSpendLogsCall).not.toHaveBeenCalled();
        expect(networking.adminTopKeysCall).not.toHaveBeenCalled();
        expect(networking.adminTopModelsCall).not.toHaveBeenCalled();
        expect(networking.adminTopEndUsersCall).not.toHaveBeenCalled();
        expect(networking.teamSpendLogsCall).not.toHaveBeenCalled();
        expect(networking.tagsSpendLogsCall).not.toHaveBeenCalled();
        expect(networking.allTagNamesCall).not.toHaveBeenCalled();
        expect(networking.adminspendByProvider).not.toHaveBeenCalled();
        expect(networking.adminGlobalActivity).not.toHaveBeenCalled();
        expect(networking.adminGlobalActivityPerModel).not.toHaveBeenCalled();
      });
    },
  );

  describe("the admin-only gate", () => {
    it("proves the flush window is wide enough to catch a leaked request", async () => {
      renderUsage({ userRole: "Admin" });

      await flushPendingRequests();

      expect(networking.getProxyUISettings).toHaveBeenCalled();
      expect(networking.adminSpendLogsCall).toHaveBeenCalled();
      expect(networking.tagsSpendLogsCall).toHaveBeenCalled();
      expect(networking.adminGlobalActivity).toHaveBeenCalled();
    });

    it("still lets an admin through, so the notice is a real gate and not a dead branch", async () => {
      renderUsage({ userRole: "Admin" });

      expect(await screen.findByRole("tab", { name: "汇总" })).toBeInTheDocument();
      expect(screen.queryByText(/全代理用量仅管理员可用/)).not.toBeInTheDocument();
      await waitFor(() => expect(networking.adminSpendLogsCall).toHaveBeenCalled());
    });

    it("does not put the session token in the provider spend query", async () => {
      renderUsage({ userRole: "Admin", token: "session-jwt-value" });

      await waitFor(() => expect(networking.adminspendByProvider).toHaveBeenCalled());
      const callArgs = networking.adminspendByProvider.mock.calls[0];
      expect(callArgs).not.toContain("session-jwt-value");
      expect(callArgs[0]).toBe("sk-test");
    });
  });
});
