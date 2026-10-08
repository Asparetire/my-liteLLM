import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CacheSettings from "./index";

const { getCacheSettingsCall, testCacheConnectionCall, updateCacheSettingsCall } = vi.hoisted(() => ({
  getCacheSettingsCall: vi.fn(),
  testCacheConnectionCall: vi.fn(),
  updateCacheSettingsCall: vi.fn(),
}));

vi.mock("@/components/networking", () => ({
  getCacheSettingsCall,
  testCacheConnectionCall,
  updateCacheSettingsCall,
}));

vi.mock("@/components/llm_calls/fetch_models", () => ({
  fetchAvailableModels: vi.fn().mockResolvedValue([]),
}));

const renderSettings = () => render(<CacheSettings accessToken="sk-test" userRole="Admin" userID="u1" />);

describe("CacheSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCacheSettingsCall.mockResolvedValue({ current_values: {} });
    updateCacheSettingsCall.mockResolvedValue({ status: "success" });
    testCacheConnectionCall.mockResolvedValue({ status: "success" });
  });

  it("should render the connection fields once current values load", async () => {
    renderSettings();
    expect(await screen.findByText("连接设置")).toBeInTheDocument();
  });

  describe("when the redis type is node", () => {
    it("should show the connection fields and hide cluster/sentinel/semantic fields", async () => {
      renderSettings();

      expect(await screen.findByText("Redis URL")).toBeInTheDocument();
      expect(screen.getByText("数据库编号")).toBeInTheDocument();
      expect(screen.queryByText("启动节点")).not.toBeInTheDocument();
      expect(screen.queryByText("哨兵节点")).not.toBeInTheDocument();
      expect(screen.queryByText("嵌入模型")).not.toBeInTheDocument();
    });
  });

  describe("when the redis type is cluster", () => {
    it("should reveal the cluster startup nodes field", async () => {
      getCacheSettingsCall.mockResolvedValue({ current_values: { redis_type: "cluster" } });
      renderSettings();
      expect(await screen.findByText("启动节点")).toBeInTheDocument();
    });
  });

  describe("when the redis type is sentinel", () => {
    it("should reveal the sentinel fields", async () => {
      getCacheSettingsCall.mockResolvedValue({ current_values: { redis_type: "sentinel" } });
      renderSettings();
      expect(await screen.findByText("哨兵节点")).toBeInTheDocument();
      expect(screen.getByText("服务名称")).toBeInTheDocument();
    });
  });

  describe("when the redis type is semantic", () => {
    it("should reveal the semantic fields", async () => {
      getCacheSettingsCall.mockResolvedValue({ current_values: { redis_type: "semantic" } });
      renderSettings();
      expect(await screen.findByText("相似度阈值")).toBeInTheDocument();
      expect(screen.getByText("嵌入模型")).toBeInTheDocument();
    });
  });

  describe("when a field fails inline validation", () => {
    it("should block save and surface the validation message", async () => {
      const user = userEvent.setup();
      renderSettings();

      const port = await screen.findByLabelText("端口");
      await user.clear(port);
      fireEvent.change(port, { target: { value: "99999" } });
      await user.click(screen.getByRole("button", { name: /保存更改/ }));

      expect(await screen.findByText(/端口必须是 1 到 65535 之间的整数/)).toBeInTheDocument();
      expect(updateCacheSettingsCall).not.toHaveBeenCalled();
    });

    it("should block save when a list field holds malformed JSON instead of silently dropping it", async () => {
      const user = userEvent.setup();
      getCacheSettingsCall.mockResolvedValue({ current_values: { redis_type: "cluster" } });
      renderSettings();

      const startupNodes = await screen.findByLabelText("启动节点");
      fireEvent.change(startupNodes, { target: { value: "not json" } });
      await user.click(screen.getByRole("button", { name: /保存更改/ }));

      expect(await screen.findByText(/必须是合法的 JSON 数组/)).toBeInTheDocument();
      expect(updateCacheSettingsCall).not.toHaveBeenCalled();
    });

    it("should block save with an error when a non-numeric value is entered into a numeric field", async () => {
      const user = userEvent.setup();
      renderSettings();

      const db = await screen.findByLabelText("数据库编号");
      fireEvent.change(db, { target: { value: "redis://host:6379/1" } });
      await user.click(screen.getByRole("button", { name: /保存更改/ }));

      expect(await screen.findByText(/必须是非负整数/)).toBeInTheDocument();
      expect(updateCacheSettingsCall).not.toHaveBeenCalled();
    });
  });

  describe("when saving a valid node configuration", () => {
    it("should send the backend payload shape with type redis and no UI-only fields", async () => {
      const user = userEvent.setup();
      renderSettings();

      const host = await screen.findByLabelText("主机");
      fireEvent.change(host, { target: { value: "localhost" } });
      await user.click(screen.getByRole("button", { name: /保存更改/ }));

      await waitFor(() =>
        expect(updateCacheSettingsCall).toHaveBeenCalledWith("sk-test", {
          type: "redis",
          host: "localhost",
          port: "6379",
          ssl: false,
          ssl_check_hostname: false,
        }),
      );
    });

    it("should include a numeric field like Database Index in the save payload", async () => {
      const user = userEvent.setup();
      renderSettings();

      fireEvent.change(await screen.findByLabelText("Redis URL"), { target: { value: "redis://host:6379/1" } });
      fireEvent.change(await screen.findByLabelText("数据库编号"), { target: { value: "2" } });
      await user.click(screen.getByRole("button", { name: /保存更改/ }));

      await waitFor(() => expect(updateCacheSettingsCall).toHaveBeenCalled());
      expect(updateCacheSettingsCall.mock.calls[0][1]).toMatchObject({ db: 2, url: "redis://host:6379/1" });
    });
  });
});
