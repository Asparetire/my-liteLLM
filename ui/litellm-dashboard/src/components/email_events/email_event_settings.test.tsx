import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/../tests/test-utils";
import EmailEventSettings from "./email_event_settings";

const { getEmailEventSettings, updateEmailEventSettings, resetEmailEventSettings } = vi.hoisted(() => ({
  getEmailEventSettings: vi.fn(),
  updateEmailEventSettings: vi.fn(),
  resetEmailEventSettings: vi.fn(),
}));

vi.mock("@/components/networking", () => ({
  getEmailEventSettings,
  updateEmailEventSettings,
  resetEmailEventSettings,
}));

const settingsResponse = {
  settings: [
    { event: "Virtual Key Created", enabled: true },
    { event: "New User Invitation", enabled: false },
  ],
};

describe("EmailEventSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEmailEventSettings.mockResolvedValue(settingsResponse);
    updateEmailEventSettings.mockResolvedValue({});
    resetEmailEventSettings.mockResolvedValue({});
  });

  it("renders the heading and the explanatory copy", async () => {
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    expect(await screen.findByText("邮件通知")).toBeInTheDocument();
    expect(screen.getByText("选择哪些事件应触发邮件通知。")).toBeInTheDocument();
  });

  it("renders one checkbox per event, reflecting the persisted enabled state", async () => {
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    await screen.findByText("Virtual Key Created");
    const checkboxes = screen.getAllByRole("checkbox");

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("renders a per-event description", async () => {
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    expect(
      await screen.findByText(/创建新虚拟密钥/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/创建新用户时/),
    ).toBeInTheDocument();
  });

  it("saves the toggled enabled flags rather than the originally fetched ones", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    await screen.findByText("Virtual Key Created");
    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => {
      expect(updateEmailEventSettings).toHaveBeenCalledWith("sk-test", {
        settings: [
          { event: "Virtual Key Created", enabled: true },
          { event: "New User Invitation", enabled: true },
        ],
      });
    });
  });

  it("unchecking an enabled event is persisted as disabled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    await screen.findByText("Virtual Key Created");
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => {
      expect(updateEmailEventSettings).toHaveBeenCalledWith("sk-test", {
        settings: [
          { event: "Virtual Key Created", enabled: false },
          { event: "New User Invitation", enabled: false },
        ],
      });
    });
  });

  it("resets to defaults and refetches the settings", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    await screen.findByText("Virtual Key Created");
    expect(getEmailEventSettings).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "重置为默认值" }));

    await waitFor(() => {
      expect(resetEmailEventSettings).toHaveBeenCalledWith("sk-test");
    });
    await waitFor(() => {
      expect(getEmailEventSettings).toHaveBeenCalledTimes(2);
    });
  });

  it("does not render event rows while the fetch is in flight", () => {
    getEmailEventSettings.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<EmailEventSettings accessToken="sk-test" />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存更改" })).toBeDisabled();
  });

  it("does not call the API when there is no access token", async () => {
    renderWithProviders(<EmailEventSettings accessToken={null} />);

    await waitFor(() => {
      expect(getEmailEventSettings).not.toHaveBeenCalled();
    });
  });
});
