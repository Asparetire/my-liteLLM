import { fireEvent, renderWithProviders, screen, waitFor } from "../../../tests/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingFormBody } from "./OnboardingFormBody";

const defaultProps = {
  variant: "signup" as const,
  userEmail: "test@example.com",
  isPending: false,
  claimError: null,
};

describe("OnboardingFormBody submit payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends exactly {password} and never leaks the email field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<OnboardingFormBody {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "hunter2" } });
    await user.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toStrictEqual({ password: "hunter2" });
  });

  it("submits on Enter from the password field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<OnboardingFormBody {...defaultProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("密码"), "hunter2{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toStrictEqual({ password: "hunter2" });
  });

  it("blocks submit and marks the password invalid when it is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<OnboardingFormBody {...defaultProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => expect(screen.getByLabelText("密码")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("为你的账号创建密码")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the password help text always visible and variant specific", async () => {
    const { unmount } = renderWithProviders(<OnboardingFormBody {...defaultProps} onSubmit={vi.fn()} />);
    expect(screen.getByText("为你的账号创建密码")).toBeInTheDocument();
    unmount();

    renderWithProviders(<OnboardingFormBody {...defaultProps} variant="reset_password" onSubmit={vi.fn()} />);
    expect(screen.getByText("输入你的新密码")).toBeInTheDocument();
  });
});
