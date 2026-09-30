import React from "react";
import { renderWithProviders, screen } from "../../../tests/test-utils";
import { describe, it, expect } from "vitest";
import { OnboardingLoadingView } from "./OnboardingLoadingView";

describe("OnboardingLoadingView", () => {
  it("should expose the loading state to assistive technology", () => {
    renderWithProviders(<OnboardingLoadingView />);
    expect(screen.getByRole("status", { name: "加载中" })).toBeInTheDocument();
  });

  it("should apply centering layout classes", () => {
    const { container } = renderWithProviders(<OnboardingLoadingView />);
    expect(container.firstChild).toHaveClass("flex", "justify-center");
  });
});
