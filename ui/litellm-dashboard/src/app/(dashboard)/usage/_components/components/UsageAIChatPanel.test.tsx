import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/../tests/test-utils";
import UsageAIChatPanel from "./UsageAIChatPanel";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

vi.mock("@/components/networking", () => ({
  modelHubCall: vi.fn().mockResolvedValue({
    data: [{ model_group: "gpt-4" }, { model_group: "claude-3-opus" }],
  }),
  usageAiChatStream: vi.fn(),
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  accessToken: "test-token",
};

describe("UsageAIChatPanel", () => {
  it("should render the panel when open", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    expect(screen.getByText("向 AI 提问")).toBeInTheDocument();
    expect(screen.getByText("询问你的消耗、模型、密钥与趋势")).toBeInTheDocument();
  });

  it("should render model selector", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    // One library paints the prompt as its own text node and the other leaves it on the input's
    // placeholder attribute, so either one means the user is being told what to pick.
    const prompt = "选择模型（可选，默认 gpt-4o-mini）";
    expect(screen.queryAllByText(prompt).length + screen.queryAllByPlaceholderText(prompt).length).toBeGreaterThan(0);
  });

  it("should render empty state message when no conversation", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    expect(screen.getByText("询问你的用量问题")).toBeInTheDocument();
  });

  it("should render the send button", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    expect(screen.getByText("发送")).toBeInTheDocument();
  });

  it("should render input placeholder", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    expect(screen.getByPlaceholderText("询问你的用量…")).toBeInTheDocument();
  });

  it("should render clear chat button", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} />);

    expect(screen.getByText("清空对话")).toBeInTheDocument();
  });

  it("should have the panel element even when closed (just off-screen)", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} open={false} />);

    expect(screen.getByTestId("usage-ai-chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("usage-ai-chat-panel")).toHaveClass("translate-x-full");
  });

  it("should not have translate-x-full class when open", () => {
    renderWithProviders(<UsageAIChatPanel {...defaultProps} open={true} />);

    expect(screen.getByTestId("usage-ai-chat-panel")).not.toHaveClass("translate-x-full");
    expect(screen.getByTestId("usage-ai-chat-panel")).toHaveClass("translate-x-0");
  });
});
