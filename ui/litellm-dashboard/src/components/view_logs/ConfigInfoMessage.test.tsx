import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigInfoMessage } from "./ConfigInfoMessage";

describe("ConfigInfoMessage", () => {
  it("should render the info message when show is true", () => {
    render(<ConfigInfoMessage show={true} />);
    expect(screen.getByText("无法显示请求日志配置")).toBeInTheDocument();
  });

  it("should render nothing when show is false", () => {
    const { container } = render(<ConfigInfoMessage show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should display the YAML config snippet", () => {
    render(<ConfigInfoMessage show={true} />);
    expect(screen.getByText(/store_prompts_in_spend_logs: true/)).toBeInTheDocument();
  });

  it("should reference Admin Settings logging settings entry", () => {
    render(<ConfigInfoMessage show={true} />);
    expect(screen.getByText(/管理设置的日志设置/)).toBeInTheDocument();
  });
});
