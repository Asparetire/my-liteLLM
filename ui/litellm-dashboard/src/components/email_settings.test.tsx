import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/../tests/test-utils";
import EmailSettings from "./email_settings";

const { serviceHealthCheck, setCallbacksCall } = vi.hoisted(() => ({
  serviceHealthCheck: vi.fn(),
  setCallbacksCall: vi.fn(),
}));

vi.mock("@/components/networking", () => ({ serviceHealthCheck, setCallbacksCall }));

vi.mock("./email_events", () => ({
  EmailEventSettings: () => <div>email event settings</div>,
}));

const alerts = [
  {
    name: "email",
    variables: {
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_PASSWORD: "********",
      EMAIL_LOGO_URL: "https://example.com/logo.png",
    },
  },
  { name: "slack", variables: { SLACK_WEBHOOK_URL: "https://hooks.example.com" } },
];

const inputNamed = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"][data-slot="input-group-control"]`) ||
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

describe("EmailSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCallbacksCall.mockResolvedValue({});
    serviceHealthCheck.mockResolvedValue({});
  });

  it("renders the heading and the docs link", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    expect(screen.getByText("邮件服务器设置")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /LiteLLM 文档：邮件告警/ })).toHaveAttribute(
      "href",
      "https://docs.litellm.ai/docs/proxy/email",
    );
  });

  it("renders one named input per email variable and none for other alert types", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    expect(inputNamed("SMTP_HOST")).toHaveValue("smtp.example.com");
    expect(inputNamed("SMTP_PORT")).toHaveValue("587");
    expect(inputNamed("SMTP_PASSWORD")).toHaveValue("********");
    expect(document.querySelector('input[name="SLACK_WEBHOOK_URL"]')).toBeNull();
  });

  it("labels each variable and shows its help text", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    expect(screen.getByText("SMTP_HOST")).toBeInTheDocument();
    expect(screen.getByText(/输入 SMTP 主机地址/)).toBeInTheDocument();
    expect(screen.getByText(/输入 SMTP 端口号/)).toBeInTheDocument();
  });

  it("submits only the fields the admin actually edited", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    await user.clear(inputNamed("SMTP_HOST"));
    fireEvent.change(inputNamed("SMTP_HOST"), { target: { value: "smtp.changed.com" } });
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => {
      expect(setCallbacksCall).toHaveBeenCalledWith("sk-test", {
        general_settings: { alerting: ["email"] },
        environment_variables: { SMTP_HOST: "smtp.changed.com" },
      });
    });
  });

  it("does not resubmit an untouched masked value", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    await user.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => {
      expect(setCallbacksCall).toHaveBeenCalledWith("sk-test", {
        general_settings: { alerting: ["email"] },
        environment_variables: {},
      });
    });
  });

  it("disables the premium-only fields for non-premium users", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser={false} alerts={alerts} />);

    expect(inputNamed("EMAIL_LOGO_URL")).toBeDisabled();
    expect(inputNamed("SMTP_HOST")).toBeEnabled();
  });

  it("leaves the premium-only fields editable for premium users", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    expect(inputNamed("EMAIL_LOGO_URL")).toBeEnabled();
  });

  it("triggers a live email health check", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    await user.click(screen.getByRole("button", { name: "测试邮件告警" }));

    await waitFor(() => {
      expect(serviceHealthCheck).toHaveBeenCalledWith("sk-test", "email");
    });
  });

  it("renders the email event settings section", () => {
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    expect(screen.getByText("email event settings")).toBeInTheDocument();
  });

  it("toggles credential visibility when eye icon is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettings accessToken="sk-test" premiumUser alerts={alerts} />);

    const passwordInput = inputNamed("SMTP_PASSWORD");
    expect(passwordInput).toHaveAttribute("type", "password");

    const showButtons = screen.getAllByLabelText("显示凭据");
    expect(showButtons.length).toBeGreaterThan(0);

    await user.click(showButtons[0]);

    expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = screen.getByLabelText("隐藏凭据");
    await user.click(hideButton);

    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
