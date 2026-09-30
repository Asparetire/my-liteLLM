import React from "react";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../../tests/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingFormBody } from "./OnboardingFormBody";

const defaultProps = {
  variant: "signup" as const,
  userEmail: "test@example.com",
  isPending: false,
  claimError: null,
  onSubmit: vi.fn(),
};

describe("OnboardingFormBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show 'Sign Up' heading for signup variant", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "注册" })).toBeInTheDocument();
  });

  it("should show 'Reset Password' heading for reset_password variant", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} variant="reset_password" />);
    expect(screen.getByRole("heading", { name: "重置密码" })).toBeInTheDocument();
  });

  it("should show SSO alert for signup variant", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} />);
    expect(screen.getByText("SSO")).toBeInTheDocument();
  });

  it("should hide SSO alert for reset_password variant", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} variant="reset_password" />);
    expect(screen.queryByText("SSO")).not.toBeInTheDocument();
  });

  it("should pre-fill the email field with userEmail", async () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} userEmail="user@example.com" />);
    await waitFor(() => {
      expect(screen.getByLabelText("邮箱地址")).toHaveValue("user@example.com");
    });
  });

  it("should disable the email field", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} />);
    expect(screen.getByLabelText("邮箱地址")).toBeDisabled();
  });

  it("should show claimError message when claimError is set", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} claimError="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should not show claimError message when claimError is null", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} claimError={null} />);
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("should show a loading indicator on the submit button when isPending is true", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} isPending={true} />);
    // antd v5 renders a loading icon with aria-label="loading" inside the button
    expect(screen.getByRole("img", { name: "加载中" })).toBeInTheDocument();
  });

  it("should call onSubmit with the typed password on form submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<OnboardingFormBody {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "mypassword" } });
    await user.click(screen.getByRole("button", { name: /注册/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ password: "mypassword" }));
    });
  });

  it("should show 'Reset Password' on the submit button for reset_password variant", () => {
    renderWithProviders(<OnboardingFormBody {...defaultProps} variant="reset_password" />);
    expect(screen.getByRole("button", { name: /重置密码/ })).toBeInTheDocument();
  });
});
