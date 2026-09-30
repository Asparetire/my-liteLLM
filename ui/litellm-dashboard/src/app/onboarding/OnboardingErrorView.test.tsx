import React from "react";
import { renderWithProviders, screen } from "../../../tests/test-utils";
import { describe, it, expect } from "vitest";
import { OnboardingErrorView } from "./OnboardingErrorView";

describe("OnboardingErrorView", () => {
  it("should show the failed to load invitation message", () => {
    renderWithProviders(<OnboardingErrorView />);
    expect(screen.getByText("加载邀请失败")).toBeInTheDocument();
  });

  it("should expose the failure as an alert to assistive technology", () => {
    renderWithProviders(<OnboardingErrorView />);
    expect(screen.getByRole("alert")).toHaveTextContent("加载邀请失败");
  });

  it("should show the expiry description", () => {
    renderWithProviders(<OnboardingErrorView />);
    expect(screen.getByText("邀请链接可能无效或已过期。")).toBeInTheDocument();
  });

  it("should render a Back to Login link pointing to /ui/login/", () => {
    renderWithProviders(<OnboardingErrorView />);
    const link = screen.getByRole("link", { name: "返回登录" });
    expect(link).toHaveAttribute("href", "/ui/login/");
  });
});
