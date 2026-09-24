import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../../tests/test-utils";
import CostTrackingSettings from "./cost_tracking_settings";

const mockDiscountConfig = vi.fn(() => ({}));
const mockMarginConfig = vi.fn(() => ({}));
const mockRemoveDiscount = vi.fn();
const mockRemoveMargin = vi.fn();

const stableDiscountCallbacks = {
  fetchDiscountConfig: vi.fn().mockResolvedValue(undefined),
  handleAddProvider: vi.fn().mockResolvedValue(true),
  handleRemoveProvider: mockRemoveDiscount,
  handleDiscountChange: vi.fn().mockResolvedValue(undefined),
};

const stableMarginCallbacks = {
  fetchMarginConfig: vi.fn().mockResolvedValue(undefined),
  handleAddMargin: vi.fn().mockResolvedValue(true),
  handleRemoveMargin: mockRemoveMargin,
  handleMarginChange: vi.fn().mockResolvedValue(undefined),
};

vi.mock("./use_discount_config", () => ({
  useDiscountConfig: () => ({ discountConfig: mockDiscountConfig(), ...stableDiscountCallbacks }),
}));

vi.mock("./use_margin_config", () => ({
  useMarginConfig: () => ({ marginConfig: mockMarginConfig(), ...stableMarginCallbacks }),
}));

vi.mock("./pricing_calculator/index", () => ({
  default: () => <div data-testid="pricing-calculator">Pricing Calculator</div>,
}));

vi.mock("@/components/llm_calls/fetch_models", () => ({
  fetchAvailableModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/HelpLink", () => ({
  DocsMenu: () => null,
}));

vi.mock("./how_it_works", () => ({
  default: () => <div data-testid="how-it-works">How It Works</div>,
}));

vi.mock("@/components/provider_info_helpers", () => ({
  Providers: { OpenAI: "OpenAI" },
  provider_map: { OpenAI: "openai" },
  providerLogoMap: {},
  getProviderLogoAndName: (providerValue: string) => ({ logo: "", displayName: providerValue }),
}));

const ADMIN_PROPS = {
  userID: "user-1",
  userRole: "proxy_admin",
  accessToken: "test-token",
};
describe("CostTrackingSettings submit paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscountConfig.mockReturnValue({});
    mockMarginConfig.mockReturnValue({});
  });

  const openDiscountModal = async (user: ReturnType<typeof userEvent.setup>) => {
    renderWithProviders(<CostTrackingSettings {...ADMIN_PROPS} />);
    const header = screen.getByText("提供商折扣").closest("button");
    if (header) await user.click(header);
    await user.click(await screen.findByRole("button", { name: "+ 添加提供商折扣" }));
    await screen.findByRole("dialog", { name: "添加提供商折扣" });
  };

  const submitDiscount = () =>
    screen
      .getAllByRole("button")
      .filter((button) => (button.textContent || "").trim() === "添加提供商折扣")
      .pop()!;

  it("requests the discount exactly once per click", async () => {
    const user = userEvent.setup();
    await openDiscountModal(user);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click((await screen.findAllByRole("option"))[0]);
    fireEvent.change(screen.getByLabelText(/折扣百分比/), { target: { value: "5" } });
    await user.click(submitDiscount());

    await waitFor(() => expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalled());
    expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalledTimes(1);
    expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalledWith("OpenAI", "5");
  });

  it("requests the margin exactly once per click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CostTrackingSettings {...ADMIN_PROPS} />);
    const header = screen.getByText("费率加价").closest("button");
    if (header) await user.click(header);
    await user.click(await screen.findByRole("button", { name: "+ 添加提供商加价" }));
    await screen.findByRole("dialog", { name: "添加提供商加价" });

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click((await screen.findAllByRole("option"))[0]);
    fireEvent.change(screen.getByLabelText(/加价百分比/), { target: { value: "10" } });

    const submit = screen
      .getAllByRole("button")
      .filter((button) => (button.textContent || "").trim() === "添加提供商加价")
      .pop()!;
    await user.click(submit);

    await waitFor(() => expect(stableMarginCallbacks.handleAddMargin).toHaveBeenCalled());
    expect(stableMarginCallbacks.handleAddMargin).toHaveBeenCalledTimes(1);
  });

  it("requests the discount exactly once when Enter is pressed in the discount field", async () => {
    const user = userEvent.setup();
    await openDiscountModal(user);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click((await screen.findAllByRole("option"))[0]);
    await user.type(screen.getByLabelText(/折扣百分比/), "5{Enter}");

    await waitFor(() => expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalled());
    expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalledTimes(1);
    expect(stableDiscountCallbacks.handleAddProvider).toHaveBeenCalledWith("OpenAI", "5");
  });

  it("requests the margin exactly once when Enter is pressed in the percentage field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CostTrackingSettings {...ADMIN_PROPS} />);
    const header = screen.getByText("费率加价").closest("button");
    if (header) await user.click(header);
    await user.click(await screen.findByRole("button", { name: "+ 添加提供商加价" }));
    await screen.findByRole("dialog", { name: "添加提供商加价" });

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click((await screen.findAllByRole("option"))[0]);
    await user.type(screen.getByLabelText(/加价百分比/), "10{Enter}");

    await waitFor(() => expect(stableMarginCallbacks.handleAddMargin).toHaveBeenCalled());
    expect(stableMarginCallbacks.handleAddMargin).toHaveBeenCalledTimes(1);
  });
});
